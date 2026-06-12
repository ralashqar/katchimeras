import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAPS_API_BASE = 'https://maps-api.apple.com';
const MAX_CLUSTERS = 6;

// Privacy contract with the client: coordinates transit this function for
// resolution only - they are never stored, logged, or persisted server-side.
// Only Apple POI categories go back to the device.
type ClusterInput = {
  id: string;
  latitude: number;
  longitude: number;
};

// Probe groups: one /v1/search call per group per cluster, early-exiting on
// the first snap. Order = product priority when a cluster matches several.
// Snap policy per group: small venues snap by distance (tight radius - dense
// cities put a bakery near everything); area places like parks snap by
// containment in the result's bounding box, since their POI point sits at the
// centroid while the grounds can span a kilometre.
const PROBE_GROUPS: {
  query: string;
  categories: string[];
  snap: { kind: 'distance'; radiusMeters: number } | { kind: 'containment' };
  regionDelta: number;
}[] = [
  { query: 'cafe', categories: ['Cafe'], snap: { kind: 'distance', radiusMeters: 55 }, regionDelta: 0.0012 },
  { query: 'bakery', categories: ['Bakery'], snap: { kind: 'distance', radiusMeters: 55 }, regionDelta: 0.0012 },
  {
    query: 'park',
    categories: ['Park', 'NationalPark', 'Playground'],
    snap: { kind: 'containment' },
    regionDelta: 0.004,
  },
  { query: 'market', categories: ['FoodMarket'], snap: { kind: 'distance', radiusMeters: 55 }, regionDelta: 0.0012 },
];

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function base64UrlEncode(data: Uint8Array | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string) {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

async function createMapsAuthToken(teamId: string, keyId: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ iss: teamId, iat: now, exp: now + 1200 }));
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getAccessToken(teamId: string, keyId: string, privateKeyPem: string) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const authToken = await createMapsAuthToken(teamId, keyId, privateKeyPem);
  const response = await fetch(`${MAPS_API_BASE}/v1/token`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!response.ok) {
    throw new Error(`Apple Maps token exchange failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { accessToken: string; expiresInSeconds: number };
  cachedAccessToken = {
    token: data.accessToken,
    expiresAt: Date.now() + data.expiresInSeconds * 1000,
  };
  return data.accessToken;
}

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

type AppleSearchResult = {
  name?: string;
  poiCategory?: string;
  coordinate?: { latitude: number; longitude: number };
  displayMapRegion?: {
    southLatitude: number;
    westLongitude: number;
    northLatitude: number;
    eastLongitude: number;
  };
};

const CONTAINMENT_PADDING_DEGREES = 0.0003;

function snapsToResult(
  cluster: ClusterInput,
  result: AppleSearchResult,
  snap: { kind: 'distance'; radiusMeters: number } | { kind: 'containment' }
) {
  if (snap.kind === 'distance') {
    return (
      result.coordinate !== undefined &&
      getDistanceMeters(
        cluster.latitude,
        cluster.longitude,
        result.coordinate.latitude,
        result.coordinate.longitude
      ) <= snap.radiusMeters
    );
  }

  const region = result.displayMapRegion;
  return (
    region !== undefined &&
    cluster.latitude >= region.southLatitude - CONTAINMENT_PADDING_DEGREES &&
    cluster.latitude <= region.northLatitude + CONTAINMENT_PADDING_DEGREES &&
    cluster.longitude >= region.westLongitude - CONTAINMENT_PADDING_DEGREES &&
    cluster.longitude <= region.eastLongitude + CONTAINMENT_PADDING_DEGREES
  );
}

async function resolveCluster(cluster: ClusterInput, accessToken: string) {
  for (const group of PROBE_GROUPS) {
    const params = new URLSearchParams({
      q: group.query,
      searchRegion: [
        cluster.latitude + group.regionDelta,
        cluster.longitude + group.regionDelta,
        cluster.latitude - group.regionDelta,
        cluster.longitude - group.regionDelta,
      ].join(','),
      searchRegionPriority: 'required',
      resultTypeFilter: 'Poi',
      includePoiCategories: group.categories.join(','),
    });

    const response = await fetch(`${MAPS_API_BASE}/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as { results?: AppleSearchResult[] };
    const snapped = (data.results ?? []).find((result) => snapsToResult(cluster, result, group.snap));

    if (snapped) {
      return {
        clusterId: cluster.id,
        appleCategory: snapped.poiCategory ?? group.categories[0],
      };
    }
  }

  return { clusterId: cluster.id, appleCategory: null };
}

function isValidCluster(value: unknown): value is ClusterInput {
  if (!value || typeof value !== 'object') return false;
  const cluster = value as Record<string, unknown>;
  return (
    typeof cluster.id === 'string' &&
    typeof cluster.latitude === 'number' &&
    typeof cluster.longitude === 'number' &&
    Math.abs(cluster.latitude) <= 90 &&
    Math.abs(cluster.longitude) <= 180
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const teamId = Deno.env.get('APPLE_MAPS_TEAM_ID');
  const keyId = Deno.env.get('APPLE_MAPS_KEY_ID');
  const privateKey = Deno.env.get('APPLE_MAPS_PRIVATE_KEY');

  if (!teamId || !keyId || !privateKey) {
    return jsonResponse({ error: 'Apple Maps secrets are not configured.' }, 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const clusters = (body as Record<string, unknown>)?.clusters;
  if (!Array.isArray(clusters) || clusters.length === 0 || !clusters.every(isValidCluster)) {
    return jsonResponse({ error: 'clusters must be a non-empty array of {id, latitude, longitude}.' }, 400);
  }

  try {
    const accessToken = await getAccessToken(teamId, keyId, privateKey);
    const limited = clusters.slice(0, MAX_CLUSTERS);

    if ((body as Record<string, unknown>).debug === true) {
      const cluster = limited[0];
      const raw: Record<string, unknown> = {};
      for (const group of PROBE_GROUPS) {
        const params = new URLSearchParams({
          q: group.query,
          searchRegion: [
            cluster.latitude + group.regionDelta,
            cluster.longitude + group.regionDelta,
            cluster.latitude - group.regionDelta,
            cluster.longitude - group.regionDelta,
          ].join(','),
          searchRegionPriority: 'required',
          resultTypeFilter: 'Poi',
          includePoiCategories: group.categories.join(','),
        });
        const response = await fetch(`${MAPS_API_BASE}/v1/search?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        raw[group.query] = { status: response.status, body: await response.text() };
      }
      return jsonResponse({ debug: raw });
    }
    const categories = await Promise.all(
      limited.map((cluster) => resolveCluster(cluster, accessToken))
    );

    return jsonResponse({ categories });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Place resolution failed.';
    return jsonResponse({ error: message }, 502);
  }
});
