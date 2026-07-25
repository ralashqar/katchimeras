import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import type { ImageSourcePropType } from 'react-native';

import { setDevAssetOverridesMap } from '@/utils/dev-asset-overrides';
import { supabase } from '@/utils/supabase';

// The Asset Lab store (dev tool): generation calls + the on-device iteration
// manifest. Every generation is remembered per assetKey (prompt, grid, cells);
// KEPT cells are downloaded (optionally BiRefNet-matted first) into the
// documents dir, and one kept file can be set as the LIVE OVERRIDE the real
// Kingdom renders (utils/dev-asset-overrides.ts). Bundling still goes through
// the desktop optimizer (slice 3) — this loop is for iteration speed only.

export type AssetLabMode = 'single' | '2x2' | '4x4';
export type AssetLabModel = 'nano' | 'gpt';

export type AssetLabCell = {
  index: number;
  url: string;
  // Set once the cell was kept: the local (matted) copy in the documents dir.
  keptUri?: string | null;
  // Uploaded to the promotion drop-box (awaiting the desktop optimizer).
  approved?: boolean;
};

export type AssetLabIteration = {
  id: string;
  assetKey: string;
  prompt: string;
  mode: AssetLabMode;
  model: AssetLabModel;
  createdAt: string;
  gridUrl: string;
  cells: AssetLabCell[];
};

export type AssetLabManifest = {
  // assetKey → local file uri rendered INSTEAD of the bundled art (dev only).
  overrides: Record<string, string>;
  // assetKey → iterations, newest first.
  history: Record<string, AssetLabIteration[]>;
};

const EMPTY_MANIFEST: AssetLabManifest = { overrides: {}, history: {} };

function labDirectory(): Directory {
  const dir = new Directory(Paths.document, 'asset-lab');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

function manifestFile(): File {
  return new File(labDirectory(), 'manifest.json');
}

export async function loadAssetLabManifest(): Promise<AssetLabManifest> {
  try {
    const file = manifestFile();
    if (!file.exists) return { ...EMPTY_MANIFEST };
    const parsed = JSON.parse(await file.text()) as Partial<AssetLabManifest>;
    const manifest: AssetLabManifest = {
      overrides: parsed.overrides ?? {},
      history: parsed.history ?? {},
    };
    setDevAssetOverridesMap(manifest.overrides);
    return manifest;
  } catch {
    return { ...EMPTY_MANIFEST };
  }
}

export function saveAssetLabManifest(manifest: AssetLabManifest): void {
  const file = manifestFile();
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify(manifest));
  setDevAssetOverridesMap(manifest.overrides);
}

// Sanitize an assetKey into the [a-z0-9-] outputName the edge fns require.
function outputNameFor(assetKey: string): string {
  return assetKey.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
}

function mimeForUri(uri: string): string {
  if (uri.endsWith('.webp')) return 'image/webp';
  if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

// The img2img reference: the CURRENT art for this asset, as base64 (bundled
// module → local file → base64). Keeps generations style-anchored to what's
// already in the world.
export async function referenceForSource(source: ImageSourcePropType): Promise<{ base64: string; mime: string }> {
  const asset = Asset.fromModule(source as number | string);
  await asset.downloadAsync();
  const localUri = asset.localUri ?? asset.uri;
  if (!localUri) {
    throw new Error('Could not resolve the bundled asset to a local file.');
  }
  const base64 = await new File(localUri).base64();
  return { base64, mime: mimeForUri(localUri.toLowerCase()) };
}

export async function generateAssetVariants(options: {
  assetKey: string;
  prompt: string;
  mode: AssetLabMode;
  model: AssetLabModel;
  reference: { base64: string; mime: string };
  // Optional second input image — a geometry template (e.g. the iso camera
  // guide) sent alongside the style reference.
  guide?: { base64: string; mime: string };
  registry?: {
    assetType: 'creature_cutout' | 'hatchling' | 'resident_hex_tile' | 'resident_environment' | 'expression_grid' | 'other';
    aspectId?: string;
    skinId?: string;
    pipelineVersion?: string;
  };
}): Promise<AssetLabIteration> {
  const outputName = outputNameFor(options.assetKey);
  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('generate-asset', { body });
    if (error) {
      throw new Error(error.message ?? 'Generation failed.');
    }
    return data;
  };
  let data = await invoke({
    prompt: options.prompt,
    referenceBase64: options.reference.base64,
    referenceMime: options.reference.mime,
    ...(options.guide ? { guideBase64: options.guide.base64, guideMime: options.guide.mime } : {}),
    mode: options.mode,
    model: options.model,
    outputName,
    assetKey: options.assetKey,
    assetType: options.registry?.assetType,
    aspectId: options.registry?.aspectId,
    skinId: options.registry?.skinId,
    pipelineVersion: options.registry?.pipelineVersion ?? 'asset-lab-v1',
  });
  // Slow models (gpt) QUEUE on fal — the edge fn returns {status:'queued',
  // requestId} and we poll until the render lands (same flow as the desktop
  // scripts; keeps every invocation under the edge gateway timeout).
  if (data && data.status === 'queued' && typeof data.requestId === 'string') {
    const requestId = data.requestId as string;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      data = await invoke({
        action: 'poll',
        requestId,
        model: options.model,
        mode: options.mode,
        outputName,
        assetKey: options.assetKey,
        assetType: options.registry?.assetType,
        aspectId: options.registry?.aspectId,
        skinId: options.registry?.skinId,
        pipelineVersion: options.registry?.pipelineVersion ?? 'asset-lab-v1',
        prompt: options.prompt,
      });
      if (data?.status === 'completed') break;
    }
  }
  if (!data || typeof data.gridUrl !== 'string' || !Array.isArray(data.cells)) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Generation returned no cells.');
  }
  return {
    id: `${options.assetKey}-${Date.now()}`,
    assetKey: options.assetKey,
    prompt: options.prompt,
    mode: options.mode,
    model: options.model,
    createdAt: new Date().toISOString(),
    gridUrl: data.gridUrl,
    cells: (data.cells as { index: number; url: string }[]).map((cell) => ({ index: cell.index, url: cell.url })),
  };
}

// Approve a KEPT cell for bundling: uploads the local PNG to the promotion
// drop-box (asset-lab-approved/<assetKey>__<ts>.png). The desktop optimizer
// (scripts/promote-dev-assets.py) pulls that folder, trims/resizes/WebPs, and
// writes real bundled assets — the only road into the app bundle.
export async function approveKeptCell(options: { assetKey: string; keptUri: string }): Promise<void> {
  const base64 = await new File(options.keptUri).base64();
  const { data, error } = await supabase.functions.invoke('approve-asset', {
    body: { assetKey: options.assetKey, base64 },
  });
  if (error) {
    throw new Error(error.message ?? 'Approve failed.');
  }
  if (!data || data.status !== 'approved') {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Approve failed.');
  }
}

// Keep a cell: optionally matte it (BiRefNet, via the existing edge fn), then
// download the final PNG into the lab directory. Returns the local uri.
export async function keepCell(options: { assetKey: string; cellUrl: string; matte: boolean }): Promise<string> {
  let finalUrl = options.cellUrl;
  if (options.matte) {
    const { data, error } = await supabase.functions.invoke('remove-image-background', {
      body: {
        imageUrl: options.cellUrl,
        outputName: outputNameFor(options.assetKey),
        model: 'BiRefNet_lite',
      },
    });
    if (error) {
      throw new Error(error.message ?? 'Matting failed.');
    }
    if (!data || typeof data.imageUrl !== 'string') {
      throw new Error(typeof data?.error === 'string' ? data.error : 'Matting returned no image.');
    }
    finalUrl = data.imageUrl;
  }
  const destination = new File(labDirectory(), `${outputNameFor(options.assetKey)}-${Date.now()}.png`);
  const downloaded = await File.downloadFileAsync(finalUrl, destination, { idempotent: true });
  return downloaded.uri;
}
