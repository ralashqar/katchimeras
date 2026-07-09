const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');

const {
  ROOT,
  CATALOG_PATH,
  LAYOUT_PATH,
  WORLD_ASSET_DIR,
  ENVIRONMENT_DATA_DIR,
  ENVIRONMENT_ASSET_DIR,
  BACKUP_DIR,
  TMP_DIR,
  assertInside,
  repoRelative,
  resolveRepoPath,
} = require('./lib/paths.cjs');
const { discoverWorldObjectAssets } = require('./lib/asset-registry.cjs');
const { readJson, validateDesignData } = require('./lib/validation.cjs');

const PORT = Number(process.env.WORLD_EDITOR_PORT || 5177);
const PYTHON = process.env.PYTHON || 'python';
const STYLE_REFERENCE_PATH = path.join(WORLD_ASSET_DIR, 'today', 'today_bg.png');

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backupFile(absPath, reason) {
  if (!fs.existsSync(absPath)) return null;
  assertInside(absPath, WORLD_ASSET_DIR);
  const rel = repoRelative(absPath);
  const backupPath = path.join(BACKUP_DIR, reason, stamp(), rel);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(absPath, backupPath);
  return repoRelative(backupPath);
}

function backupEnvironmentFile(absPath, reason) {
  if (!fs.existsSync(absPath)) return null;
  const resolved = path.resolve(absPath);
  const dataRel = path.relative(ENVIRONMENT_DATA_DIR, resolved);
  const assetRel = path.relative(ENVIRONMENT_ASSET_DIR, resolved);
  const inData = !dataRel.startsWith('..') && !path.isAbsolute(dataRel);
  const inAssets = !assetRel.startsWith('..') && !path.isAbsolute(assetRel);
  if (!inData && !inAssets) throw new Error(`Path escapes environment roots: ${repoRelative(resolved)}`);
  const rel = repoRelative(resolved);
  const backupPath = path.join(BACKUP_DIR, 'environment', reason, stamp(), rel);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(resolved, backupPath);
  return repoRelative(backupPath);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, shell: false, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr || stdout}`));
    });
  });
}

function loadEnv() {
  const env = {};
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('Missing .env.local');
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    env[key] = rest.join('=');
  }
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / key in .env.local');
  return { url, key };
}

async function callSupabaseFunction(fn, body) {
  const { url, key } = loadEnv();
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${url}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: text.replace(/\s+/g, ' ').trim() };
      }
      if (response.ok) return data;
      const message = data?.error || text || `${fn} failed`;
      const transient = response.status === 502 || response.status === 503 || response.status === 504;
      if (!transient || attempt === 2) throw new Error(message);
      lastError = new Error(message);
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(`${fn} failed`);
}

function fileBase64(absPath, maxBytes = 7_800_000) {
  const stat = fs.statSync(absPath);
  if (stat.size > maxBytes) throw new Error(`Reference image is too large for inline upload: ${repoRelative(absPath)}`);
  return fs.readFileSync(absPath).toString('base64');
}

function slugDash(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'environment-asset';
}

async function download(url, outPath) {
  ensureDir(path.dirname(outPath));
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not download generated image: ${await response.text()}`);
      fs.writeFileSync(outPath, Buffer.from(await response.arrayBuffer()));
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not download generated image.');
}

async function generateAsset({ prompt, referencePath, guidePath, outputName, model = 'gpt', transparent = false, imageSize = 1536, gptQuality = 'medium' }) {
  const body = {
    prompt,
    referenceBase64: fileBase64(referencePath),
    referenceMime: mimeFor(referencePath),
    mode: 'single',
    model,
    outputName: slugDash(outputName),
  };
  if (guidePath) {
    body.guideBase64 = fileBase64(guidePath);
    body.guideMime = mimeFor(guidePath);
  }
  if (model === 'gpt') {
    body.gptImageSize = imageSize;
    body.gptQuality = gptQuality === 'low' || gptQuality === 'high' ? gptQuality : 'medium';
    if (transparent) body.transparentBackground = true;
  } else {
    body.resolution = '2K';
  }
  let data = await callSupabaseFunction('generate-asset', body);
  if (data?.status === 'queued' && data.requestId) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      data = await callSupabaseFunction('generate-asset', {
        action: 'poll',
        requestId: data.requestId,
        model,
        mode: 'single',
        outputName: slugDash(outputName),
      });
      if (data?.status === 'completed') break;
    }
  }
  if (data?.error) throw new Error(data.error);
  const url = data?.cells?.[0]?.url || data?.gridUrl || data?.imageUrl;
  if (!url) throw new Error('Generation returned no image URL.');
  return url;
}

async function matteImage(inputPath, outputName) {
  const data = await callSupabaseFunction('remove-image-background', {
    imageBase64: fs.readFileSync(inputPath).toString('base64'),
    outputName: slugDash(outputName),
    model: 'General Use (Heavy)',
    operatingResolution: '2048x2048',
    refineForeground: true,
  });
  if (!data?.imageUrl) throw new Error(data?.error || 'Matting returned no image URL.');
  const outPath = path.join(TMP_DIR, 'environment-designer', `${slugDash(outputName)}-matted.png`);
  await download(data.imageUrl, outPath);
  return outPath;
}

function environmentLayoutPath(id) {
  const abs = path.join(ENVIRONMENT_DATA_DIR, `${slugDash(id).replace(/-/g, '_')}.json`);
  return assertInside(abs, ENVIRONMENT_DATA_DIR);
}

function environmentArtPath(id) {
  const abs = path.join(ENVIRONMENT_DATA_DIR, `${slugDash(id).replace(/-/g, '_')}.art.json`);
  return assertInside(abs, ENVIRONMENT_DATA_DIR);
}

function environmentDir(id) {
  return assertInside(path.join(ENVIRONMENT_ASSET_DIR, slugDash(id).replace(/-/g, '_')), ENVIRONMENT_ASSET_DIR);
}

function readEnvironment(id) {
  const layoutPath = environmentLayoutPath(id);
  if (!fs.existsSync(layoutPath)) throw new Error(`Unknown environment: ${id}`);
  const layout = readJson(layoutPath);
  const artPath = environmentArtPath(id);
  const art = normalizeArtBrief(layout, fs.existsSync(artPath) ? readJson(artPath) : {});
  return { layout, art, layoutPath, artPath, envDir: environmentDir(layout.id) };
}

function writeEnvironmentLayout(layout, reason = 'layout') {
  const layoutPath = environmentLayoutPath(layout.id);
  ensureDir(path.dirname(layoutPath));
  const backup = backupEnvironmentFile(layoutPath, reason);
  fs.writeFileSync(layoutPath, `${JSON.stringify(layout, null, 2)}\n`);
  return backup;
}

function writeEnvironmentArt(id, art, reason = 'art') {
  const artPath = environmentArtPath(id);
  ensureDir(path.dirname(artPath));
  const backup = backupEnvironmentFile(artPath, reason);
  fs.writeFileSync(artPath, `${JSON.stringify(art, null, 2)}\n`);
  return backup;
}

function defaultArtBrief(layout) {
  const domain = layout.domain || 'life';
  const basePrompt =
    domain === 'coffee'
      ? 'Square isometric cozy cafe interior, warm rounded wood, cream stone tile floor, green painted trim, soft amber pendant lights, arched windows with a bright valley view, curved counter, fireplace nook, open floor spaces and empty wall shelves reserved for later props. Keep the room polished, readable, uncluttered, and prop-ready.'
      : domain === 'food'
        ? 'Square isometric cozy feast hall and hearth kitchen, warm stone tile floor, rounded wooden beams, green accents, glowing oven and hearth, open floor spaces, empty wall shelves, and clear reserved sockets for later food-themed props. Keep the room polished, readable, uncluttered, and prop-ready.'
        : 'Square isometric cozy themed room, soft rounded forms, warm handcrafted materials, clear floor space, empty wall shelves, and reserved open areas for later props. Keep the room polished, readable, uncluttered, and prop-ready.';
  return {
    environmentId: layout.id,
    stylePrompt:
      'Match the provided reference image style: premium stylized 3D mobile-game art, soft rounded clay-like forms, cozy handcrafted materials, clean simplified surfaces, readable silhouettes, bright warm lighting, gentle contact shadows, isometric three-quarter top-down camera, square composition.',
    basePrompt,
    negativePrompt: 'No people, no readable text, no clutter, no flat vector art, no UI elements.',
    propInstructions:
      'Generate the selected object aligned to the room camera and placement rectangle. Keep the final isolated prop transparent and readable.',
    props: (layout.stations ?? []).map((station) => ({
      stationId: station.id,
      prompt: `A ${station.label} station prop matching the room style, camera angle, lighting, and material finish.`,
    })),
  };
}

function normalizeArtBrief(layout, art = {}) {
  const defaults = defaultArtBrief(layout);
  const promptsByStation = new Map();
  for (const prop of defaults.props ?? []) {
    promptsByStation.set(prop.stationId, prop.prompt);
  }
  for (const prop of art.props ?? []) {
    if (prop?.stationId && typeof prop.prompt === 'string' && prop.prompt.trim()) {
      promptsByStation.set(prop.stationId, prop.prompt.trim());
    }
  }

  return {
    ...defaults,
    ...art,
    environmentId: art.environmentId || defaults.environmentId,
    stylePrompt: typeof art.stylePrompt === 'string' && art.stylePrompt.trim() ? art.stylePrompt.trim() : defaults.stylePrompt,
    basePrompt: typeof art.basePrompt === 'string' && art.basePrompt.trim() ? art.basePrompt.trim() : defaults.basePrompt,
    negativePrompt: typeof art.negativePrompt === 'string' && art.negativePrompt.trim() ? art.negativePrompt.trim() : defaults.negativePrompt,
    propInstructions: typeof art.propInstructions === 'string' && art.propInstructions.trim() ? art.propInstructions.trim() : defaults.propInstructions,
    props: (layout.stations ?? []).map((station) => ({
      stationId: station.id,
      prompt: promptsByStation.get(station.id) || `A ${station.label} station prop matching the room style, camera angle, lighting, and material finish.`,
    })),
  };
}

function assetStatusForEnvironment(layout, envDir) {
  const basePath = ['base.png', 'base.jpg', 'base.webp'].map((name) => path.join(envDir, name)).find((item) => fs.existsSync(item));
  const guidePath = path.join(envDir, 'guide_slots.png');
  const foregroundPath = path.join(envDir, 'foreground.webp');
  const bakedScenePath = path.join(envDir, 'review', 'baked_scene.png');
  const directScenePath = path.join(envDir, 'review', 'direct_scene.png');
  const extractedBasePath = path.join(envDir, 'review', 'extracted_base.png');
  return {
    base: basePath ? { path: repoRelative(basePath), url: `/${repoRelative(basePath)}` } : null,
    guide: fs.existsSync(guidePath) ? { path: repoRelative(guidePath), url: `/${repoRelative(guidePath)}` } : null,
    foreground: fs.existsSync(foregroundPath) ? { path: repoRelative(foregroundPath), url: `/${repoRelative(foregroundPath)}` } : null,
    bakedScene: fs.existsSync(bakedScenePath) ? { path: repoRelative(bakedScenePath), url: `/${repoRelative(bakedScenePath)}` } : null,
    directScene: fs.existsSync(directScenePath) ? { path: repoRelative(directScenePath), url: `/${repoRelative(directScenePath)}` } : null,
    extractedBase: fs.existsSync(extractedBasePath) ? { path: repoRelative(extractedBasePath), url: `/${repoRelative(extractedBasePath)}` } : null,
    styleReference: fs.existsSync(STYLE_REFERENCE_PATH)
      ? { path: repoRelative(STYLE_REFERENCE_PATH), url: `/${repoRelative(STYLE_REFERENCE_PATH)}` }
      : null,
    stations: (layout.stations ?? []).map((station) => {
      const reviewDir = path.join(envDir, 'review');
      const revealObjectPath = station.revealObjectAssetKey
        ? path.join(envDir, 'reveal-objects', `${station.revealObjectAssetKey}.png`)
        : null;
      return {
        id: station.id,
        revealObject:
          revealObjectPath && fs.existsSync(revealObjectPath)
            ? { path: repoRelative(revealObjectPath), url: `/${repoRelative(revealObjectPath)}` }
            : null,
        levels: (station.art?.levels ?? []).map((key) => {
          const png = path.join(envDir, 'props', `${key}.png`);
          const webp = path.join(envDir, 'props', `${key}.webp`);
          const placed = path.join(reviewDir, `${key}_placed.png`);
          const fitted = path.join(reviewDir, `${key}_fitted.png`);
          const candidate = path.join(reviewDir, `${key}_candidate.png`);
          const finalPath = fs.existsSync(png) ? png : fs.existsSync(webp) ? webp : null;
          return {
            key,
            final: finalPath ? { path: repoRelative(finalPath), url: `/${repoRelative(finalPath)}` } : null,
            placed: fs.existsSync(placed) ? { path: repoRelative(placed), url: `/${repoRelative(placed)}` } : null,
            fitted: fs.existsSync(fitted) ? { path: repoRelative(fitted), url: `/${repoRelative(fitted)}` } : null,
            candidate: fs.existsSync(candidate) ? { path: repoRelative(candidate), url: `/${repoRelative(candidate)}` } : null,
          };
        }),
      };
    }),
  };
}

function environmentSummary(layout, art, envDir) {
  const assets = assetStatusForEnvironment(layout, envDir);
  const stationLevels = assets.stations.flatMap((station) => station.levels);
  return {
    id: layout.id,
    title: layout.title,
    subtitle: layout.subtitle,
    domain: layout.domain,
    ownerVisualKeys: layout.ownerVisualKeys ?? [],
    ownerCreatureIds: layout.ownerCreatureIds ?? [],
    hasBase: !!assets.base,
    stationCount: layout.stations?.length ?? 0,
    generatedPropCount: stationLevels.filter((level) => !!level.final).length,
    totalPropCount: stationLevels.length,
    artPrompt: art.basePrompt ?? '',
  };
}

function environmentDetail(id) {
  const { layout, art, envDir } = readEnvironment(id);
  return {
    environment: environmentSummary(layout, art, envDir),
    layout,
    art,
    assets: assetStatusForEnvironment(layout, envDir),
  };
}

function rectFromBody(body) {
  const rect = body?.rect ?? body?.hitbox ?? body;
  const out = {
    x: Math.round(Number(rect?.x)),
    y: Math.round(Number(rect?.y)),
    w: Math.round(Number(rect?.w)),
    h: Math.round(Number(rect?.h)),
  };
  if (![out.x, out.y, out.w, out.h].every(Number.isFinite) || out.w < 8 || out.h < 8) {
    throw new Error('Provide a valid rectangle {x,y,w,h}.');
  }
  return out;
}

function maskFromBody(body) {
  const mask = body?.mask ?? body;
  if (mask?.type === 'polygon') {
    const points = Array.isArray(mask.points)
      ? mask.points.map((point) => ({
          x: Math.round(Number(point?.x)),
          y: Math.round(Number(point?.y)),
        }))
      : [];
    if (points.length < 3 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      throw new Error('Provide a valid polygon mask with at least three points.');
    }
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    return {
      type: 'polygon',
      points,
      bounds: {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      },
    };
  }
  return { type: 'rect', rect: rectFromBody(mask?.rect ?? body) };
}

function rectForMask(station) {
  const mask = station.revealMask;
  if (mask?.type === 'rect' && mask.rect) return rectFromBody(mask.rect);
  if (mask?.type === 'polygon' && mask.bounds) return rectFromBody(mask.bounds);
  if (mask?.type === 'polygon' && Array.isArray(mask.points) && mask.points.length >= 3) {
    const xs = mask.points.map((point) => Number(point.x));
    const ys = mask.points.map((point) => Number(point.y));
    return rectFromBody({
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys),
    });
  }
  return rectFromBody(station.hitbox);
}

function revealObjectAssetKey(layout, station) {
  return station.revealObjectAssetKey || `${slugDash(layout.id).replace(/-/g, '_')}_${slugDash(station.id).replace(/-/g, '_')}_reveal_object`;
}

function revealObjectPathForAsset(envDir, assetKey) {
  return assertInside(path.join(envDir, 'reveal-objects', `${assetKey}.png`), envDir);
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

function findStation(layout, stationId) {
  const station = layout.stations?.find((item) => item.id === stationId);
  if (!station) throw new Error(`Unknown station: ${stationId}`);
  return station;
}

function levelAssetKey(station, requested) {
  const levels = station.art?.levels ?? [];
  if (requested?.assetKey && levels.includes(requested.assetKey)) return requested.assetKey;
  const level = Math.max(1, Math.min(3, Number(requested?.level ?? 1)));
  return levels[level - 1] ?? levels[0] ?? `${station.id}_l${level}`;
}

function stationPrompt(art, station) {
  return art.props?.find((item) => item.stationId === station.id)?.prompt || `A ${station.label} station prop.`;
}

function sceneStationPrompt(art, station) {
  return stationPrompt(art, station)
    .replace(/\btransparent background\b[.,; ]*/gi, '')
    .replace(/\bLevel 1\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function effectivePrompt(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function basePathForEnvironment(envDir) {
  return ['base.png', 'base.jpg', 'base.webp'].map((name) => path.join(envDir, name)).find((item) => fs.existsSync(item));
}

function propPathForAsset(envDir, assetKey, preferCandidate = false) {
  const candidates = [
    ...(preferCandidate ? [path.join(envDir, 'review', `${assetKey}_candidate.png`)] : []),
    path.join(envDir, 'props', `${assetKey}.png`),
    path.join(envDir, 'props', `${assetKey}.webp`),
  ];
  return candidates.find((item) => fs.existsSync(item));
}

function highestAvailableAssetKey(envDir, station) {
  const levels = station.art?.levels ?? [];
  for (const key of [...levels].reverse()) {
    if (propPathForAsset(envDir, key, true)) return key;
  }
  return levels[levels.length - 1] ?? levels[0] ?? `${station.id}_l1`;
}

function sceneObjectList(layout, art, envDir) {
  return (layout.stations ?? []).map((station) => {
    const assetKey = highestAvailableAssetKey(envDir, station);
    const propPath = propPathForAsset(envDir, assetKey, true);
    return {
      id: station.id,
      label: station.label,
      kind: station.kind,
      assetKey,
      rect: station.hitbox,
      prompt: stationPrompt(art, station),
      propPath: propPath || null,
    };
  });
}

async function extractRevealObjectForStation({ layout, art, envDir, station, body = {}, persistLayout = true }) {
  const rect = rectForMask(station);
  const directScenePath = path.join(envDir, 'review', 'direct_scene.png');
  if (!fs.existsSync(directScenePath)) throw new Error('Generate a direct full-scene image first.');

  const assetKey = revealObjectAssetKey(layout, station);
  const workDir = path.join(TMP_DIR, 'environment-designer');
  ensureDir(workDir);
  const cropPath = path.join(workDir, `${assetKey}-source-crop.png`);
  const pad = Number.isFinite(Number(body?.pad)) ? Math.max(16, Math.round(Number(body.pad))) : 96;
  await run(PYTHON, [
    'scripts/environment-designer-tools.py',
    'crop-square',
    '--input',
    directScenePath,
    '--rect',
    JSON.stringify(rect),
    '--pad',
    String(pad),
    '--out',
    cropPath,
  ]);

  const prompt = [
    `Extract only the ${station.label} object or station from this crop as a clean isolated transparent PNG.`,
    stationPrompt(art, station),
    'Preserve the object identity, silhouette, scale, perspective, lighting direction, material finish, and any contact shadow attached directly to the object.',
    'Remove the room background, floor, walls, nearby objects, clutter, UI, watermarks, and readable text.',
    'Do not redesign the object. Do not add new objects. Return only the isolated object on transparent background.',
  ]
    .filter(Boolean)
    .join(' ');

  const generatedUrl = await generateAsset({
    prompt,
    referencePath: cropPath,
    outputName: `${layout.id}-${station.id}-reveal-object-raw`,
    model: body?.model === 'nano' ? 'nano' : 'gpt',
    transparent: true,
    imageSize: Math.min(1536, Math.max(1024, rect.w + pad * 2, rect.h + pad * 2)),
    gptQuality: body?.gptQuality,
  });

  const rawPath = path.join(envDir, 'review', `${assetKey}_raw.png`);
  backupEnvironmentFile(rawPath, 'reveal-object-raw');
  await download(generatedUrl, rawPath);
  const mattedPath = await matteImage(rawPath, `${assetKey}-matted`);
  const finalPath = revealObjectPathForAsset(envDir, assetKey);
  backupEnvironmentFile(finalPath, 'reveal-object');
  await run(PYTHON, [
    'scripts/environment-designer-tools.py',
    'fit',
    '--input',
    mattedPath,
    '--width',
    String(rect.w),
    '--height',
    String(rect.h),
    '--pad-ratio',
    '0',
    '--out',
    finalPath,
  ]);
  station.revealObjectAssetKey = assetKey;
  station.revealRenderMode = 'object';
  if (persistLayout) writeEnvironmentLayout(layout, 'reveal-object');
  return { stationId: station.id, path: repoRelative(finalPath), url: `/${repoRelative(finalPath)}` };
}

async function linkRevealObjectFromUrl({ layout, envDir, station, sourceUrl, persistLayout = true }) {
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error('Provide a valid image URL.');
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('Provide an http or https image URL.');
  }
  const rect = rectForMask(station);
  const assetKey = revealObjectAssetKey(layout, station);
  const rawPath = path.join(envDir, 'review', `${assetKey}_linked_raw.png`);
  backupEnvironmentFile(rawPath, 'reveal-object-linked-raw');
  await download(parsedUrl.toString(), rawPath);
  const alphaCheck = await run(PYTHON, [
    'scripts/environment-designer-tools.py',
    'has-alpha',
    '--input',
    rawPath,
  ]);
  const inputPath = alphaCheck.stdout.trim() === 'true'
    ? rawPath
    : await matteImage(rawPath, `${assetKey}-linked-matted`);
  const finalPath = revealObjectPathForAsset(envDir, assetKey);
  backupEnvironmentFile(finalPath, 'reveal-object-linked');
  await run(PYTHON, [
    'scripts/environment-designer-tools.py',
    'fit',
    '--input',
    inputPath,
    '--width',
    String(rect.w),
    '--height',
    String(rect.h),
    '--pad-ratio',
    '0',
    '--out',
    finalPath,
  ]);
  station.revealObjectAssetKey = assetKey;
  station.revealRenderMode = 'object';
  if (persistLayout) writeEnvironmentLayout(layout, 'reveal-object-linked');
  return { stationId: station.id, path: repoRelative(finalPath), url: `/${repoRelative(finalPath)}` };
}

async function updateStationPlacement(layout, station, rect) {
  const anchorY = Math.round(rect.y + rect.h * 0.85);
  station.hitbox = { ...rect };
  station.anchor = { x: Math.round(rect.x + rect.w / 2), y: anchorY };
  station.art = {
    ...station.art,
    width: rect.w,
    height: rect.h,
    anchorOffset: { x: Math.round(rect.w / 2), y: Math.round(rect.h * 0.85) },
  };
  writeEnvironmentLayout(layout, 'placement');
  await regenerateEnvironmentGuide(layout.id);
}

function defaultStationsForEnvironment(layout) {
  const domain = layout.domain || 'life';
  const prefix = slugDash(domain).replace(/-/g, '_');
  const specs =
    domain === 'food'
      ? [
          ['feast_table', 'Feast Table', 'Feast', 'stats', [1, 10, 30], { x: 450, y: 540, w: 560, h: 330 }],
          ['spice_rack', 'Spice Rack', 'Spices', 'stats', [1, 3, 6], { x: 960, y: 200, w: 330, h: 240 }],
          ['hearth_pot', 'Hearth Pot', 'Hearth', 'memories', [1, 5, 15], { x: 170, y: 820, w: 360, h: 290 }],
          ['quest_board', 'Quest Board', 'Quest', 'quest', [1, 1, 2], { x: 110, y: 470, w: 220, h: 240 }],
          ['trophy_cupboard', 'Trophy Cupboard', 'Trophy', 'milestones', [1, 3, 5], { x: 595, y: 1080, w: 340, h: 250 }],
        ]
      : [
          [`${prefix}_station`, 'Main Station', 'Main', 'stats', [1, 8, 24], { x: 450, y: 540, w: 560, h: 330 }],
          [`${prefix}_collection`, 'Collection Shelf', 'Shelf', 'stats', [1, 3, 6], { x: 960, y: 200, w: 330, h: 240 }],
          [`${prefix}_memories`, 'Memory Display', 'Memory', 'memories', [1, 5, 15], { x: 170, y: 820, w: 360, h: 290 }],
          [`${prefix}_quest_board`, 'Quest Board', 'Quest', 'quest', [1, 1, 2], { x: 110, y: 470, w: 220, h: 240 }],
          [`${prefix}_trophies`, 'Trophy Shelf', 'Trophy', 'milestones', [1, 3, 5], { x: 595, y: 1080, w: 340, h: 250 }],
        ];
  return specs.map(([id, label, shortLabel, kind, thresholds, rect], index) => ({
    id,
    label,
    shortLabel,
    kind,
    icon: kind === 'quest' ? 'square.and.pencil' : kind === 'milestones' ? 'star.fill' : 'sparkles',
    anchor: { x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y + rect.h * 0.85) },
    hitbox: rect,
    zIndex: 30 + index * 4,
    thresholds,
    art: {
      assetPrefix: id,
      width: rect.w,
      height: rect.h,
      anchorOffset: { x: Math.round(rect.w / 2), y: Math.round(rect.h * 0.85) },
      levels: [`${id}_l1`, `${id}_l2`, `${id}_l3`],
      visibleWhenLevel: 1,
      shadowMode: 'baked',
    },
  }));
}

async function regenerateEnvironmentGuide(id) {
  await run(PYTHON, ['scripts/generate-local-environment-guide.py', id]);
}

function findFamily(catalog, familyId) {
  return catalog.families.find((family) => family.id === familyId);
}

function findAsset(family, assetKey) {
  return family.assets.find((asset) => asset.assetKey === assetKey);
}

function saveCatalog(nextCatalog) {
  const layout = readJson(LAYOUT_PATH);
  const validation = validateDesignData(nextCatalog, layout);
  if (!validation.ok) {
    const error = new Error('Catalog validation failed.');
    error.validation = validation;
    throw error;
  }
  ensureDir(BACKUP_DIR);
  const backupPath = path.join(BACKUP_DIR, 'catalog', `world-object-design-catalog-${stamp()}.json`);
  ensureDir(path.dirname(backupPath));
  fs.copyFileSync(CATALOG_PATH, backupPath);
  fs.writeFileSync(CATALOG_PATH, `${JSON.stringify(nextCatalog, null, 2)}\n`);
  return { validation, backup: repoRelative(backupPath) };
}

function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function uniqueAssetKey(family, sourcePath) {
  const keys = new Set((family.assets ?? []).map((asset) => asset.assetKey));
  const baseName = slug(path.basename(sourcePath, path.extname(sourcePath))) || 'variant';
  const familyName = slug(family.generator?.name ?? family.id ?? 'asset');
  let candidate = `${familyName}_${baseName}`;
  let index = 2;
  while (keys.has(candidate)) {
    candidate = `${familyName}_${baseName}_${index}`;
    index += 1;
  }
  return candidate;
}

function copySelectedArtIntoSlot(asset, sourcePath) {
  const sourceAbs = assertInside(resolveRepoPath(sourcePath), WORLD_ASSET_DIR);
  const targetAbs = assertInside(resolveRepoPath(asset.path), WORLD_ASSET_DIR);
  if (!fs.existsSync(sourceAbs)) throw new Error(`Source asset does not exist: ${sourcePath}`);
  if (!fs.existsSync(targetAbs)) throw new Error(`Target asset does not exist: ${asset.path}`);
  const backup = backupFile(targetAbs, asset.assetKey);
  if (path.resolve(sourceAbs) !== path.resolve(targetAbs)) {
    fs.copyFileSync(sourceAbs, targetAbs);
  }
  return backup ? [backup] : [];
}

function familyAssetPaths(family) {
  return [...new Set((family.assets ?? []).map((asset) => asset.path).filter(Boolean))];
}

async function regenerateFamily(family, prompt) {
  if (family.generator?.type !== 'grid') {
    throw new Error(`Family ${family.id} does not have a grid generator.`);
  }
  const backups = [];
  for (const rel of familyAssetPaths(family)) {
    const abs = assertInside(resolveRepoPath(rel), WORLD_ASSET_DIR);
    const backup = backupFile(abs, family.id);
    if (backup) backups.push(backup);
  }
  const generator = family.generator;
  const args = [
    'scripts/generate-world-object-grid.py',
    '--name',
    generator.name,
    '--subject',
    prompt || family.prompt,
    '--ref',
    generator.ref || 'base_env2',
    '--mode',
    generator.mode || 'variants',
    '--frame',
    generator.frame || 'iso',
    '--style',
    generator.style || 'collectible',
    '--force',
  ];
  const output = await run(PYTHON, args);
  return { backups, output };
}

async function regenerateSelected(asset, prompt) {
  if (!prompt || !prompt.trim()) throw new Error('Selected-asset regeneration needs a prompt.');
  const outPath = assertInside(resolveRepoPath(asset.path), WORLD_ASSET_DIR);
  const backup = backupFile(outPath, asset.assetKey);
  ensureDir(TMP_DIR);
  const rawPath = path.join(TMP_DIR, `${asset.assetKey}-${Date.now()}-raw.png`);
  const safeName = asset.assetKey.replace(/_/g, '-').toLowerCase();
  const generated = await run(PYTHON, [
    'scripts/asset-pipeline.py',
    'generate',
    '--id',
    `world-editor-${asset.assetKey}`,
    '--prompt',
    prompt,
    '--out',
    rawPath,
  ]);
  const matted = await run(PYTHON, [
    'scripts/asset-pipeline.py',
    'matte',
    '--name',
    safeName,
    '--in',
    rawPath,
    '--out',
    outPath,
  ]);
  return { backups: backup ? [backup] : [], output: { stdout: `${generated.stdout}\n${matted.stdout}`, stderr: `${generated.stderr}\n${matted.stderr}` } };
}

async function main() {
  const app = express();
  app.use(express.json({ limit: '24mb' }));
  app.use('/assets', express.static(path.join(ROOT, 'assets'), { etag: false, maxAge: 0 }));

  app.get('/api/environments', (_req, res) => {
    try {
      ensureDir(ENVIRONMENT_DATA_DIR);
      const environments = fs
        .readdirSync(ENVIRONMENT_DATA_DIR)
        .filter((file) => file.endsWith('.json') && !file.endsWith('.art.json'))
        .map((file) => {
          const id = path.basename(file, '.json');
          const { layout, art, envDir } = readEnvironment(id);
          return environmentSummary(layout, art, envDir);
        });
      res.json({ environments });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/environments/:id', (req, res) => {
    try {
      res.json(environmentDetail(req.params.id));
    } catch (error) {
      res.status(404).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/art', (req, res) => {
    try {
      const { layout, art } = readEnvironment(req.params.id);
      if (typeof req.body?.basePrompt === 'string') art.basePrompt = req.body.basePrompt;
      if (typeof req.body?.stylePrompt === 'string') art.stylePrompt = req.body.stylePrompt;
      if (typeof req.body?.negativePrompt === 'string') art.negativePrompt = req.body.negativePrompt;
      if (typeof req.body?.propInstructions === 'string') art.propInstructions = req.body.propInstructions;
      if (req.body?.stationId && typeof req.body?.stationPrompt === 'string') {
        const stationId = String(req.body.stationId);
        art.props = Array.isArray(art.props) ? art.props : [];
        const existing = art.props.find((item) => item.stationId === stationId);
        if (existing) existing.prompt = req.body.stationPrompt;
        else art.props.push({ stationId, prompt: req.body.stationPrompt });
      }
      writeEnvironmentArt(layout.id, art, 'prompt-edit');
      res.json({ ok: true, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/base', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      ensureDir(envDir);
      const placeholderBase = ['base.png', 'base.jpg', 'base.webp'].map((name) => path.join(envDir, name)).find((item) => fs.existsSync(item));
      const referencePath = fs.existsSync(STYLE_REFERENCE_PATH) ? STYLE_REFERENCE_PATH : placeholderBase;
      if (!referencePath) throw new Error('No style reference or placeholder base exists.');
      const prompt = String(req.body?.prompt || art.basePrompt || defaultArtBrief(layout).basePrompt).trim();
      const fullPrompt = [
        prompt,
        art.stylePrompt,
        art.negativePrompt,
        'Use the style reference for material, lighting, rounded 3D shape language, and palette.',
        'Keep the base environment empty of upgrade station props. Leave clear placement spaces.',
        'No readable text, no people, no UI, no watermark.',
      ]
        .filter(Boolean)
        .join(' ');
      const generatedUrl = await generateAsset({
        prompt: fullPrompt,
        referencePath,
        outputName: `${layout.id}-base`,
        model: req.body?.model === 'nano' ? 'nano' : 'gpt',
        imageSize: layout.plate?.width ?? 1536,
      });
      const outPath = path.join(envDir, 'base.png');
      backupEnvironmentFile(outPath, 'base');
      await download(generatedUrl, outPath);
      await regenerateEnvironmentGuide(layout.id);
      art.basePrompt = prompt;
      writeEnvironmentArt(layout.id, art, 'base-prompt');
      res.json({ ok: true, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/design', (req, res) => {
    try {
      const { layout, art } = readEnvironment(req.params.id);
      if (!Array.isArray(layout.stations) || layout.stations.length === 0) {
        layout.stations = defaultStationsForEnvironment(layout);
        art.props = layout.stations.map((station) => ({
          stationId: station.id,
          prompt: `A ${station.label} station prop for ${layout.title}, matching the environment camera and style.`,
        }));
        writeEnvironmentLayout(layout, 'station-design');
        writeEnvironmentArt(layout.id, art, 'station-design');
      }
      res.json({ ok: true, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/placement', async (req, res) => {
    try {
      const { layout } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      const rect = rectFromBody(req.body);
      await updateStationPlacement(layout, station, rect);
      res.json({ ok: true, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/reveal-mask', async (req, res) => {
    try {
      const { layout } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      station.revealMask = maskFromBody(req.body);
      writeEnvironmentLayout(layout, 'reveal-mask');
      res.json({ ok: true, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/reveal-render-mode', async (req, res) => {
    try {
      const { layout } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      const mode = req.body?.mode === 'object' ? 'object' : 'mask';
      if (mode === 'object' && !station.revealObjectAssetKey) {
        throw new Error('Extract this object before switching to extracted mode.');
      }
      station.revealRenderMode = mode;
      if (req.body?.mask) {
        station.revealMask = maskFromBody(req.body);
      } else if (req.body?.rect) {
        station.revealMask = { type: 'rect', rect: rectFromBody(req.body.rect) };
      }
      writeEnvironmentLayout(layout, 'reveal-render-mode');
      res.json({ ok: true, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/extract-reveal-object', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      if (req.body?.mask) {
        station.revealMask = maskFromBody(req.body);
        writeEnvironmentLayout(layout, 'reveal-mask');
      }
      const revealObject = await extractRevealObjectForStation({ layout, art, envDir, station, body: req.body });

      res.json({
        ok: true,
        revealObject,
        ...environmentDetail(layout.id),
        cacheBust: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/link-reveal-object-url', async (req, res) => {
    try {
      const { layout, envDir } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      if (req.body?.mask) {
        station.revealMask = maskFromBody(req.body);
        writeEnvironmentLayout(layout, 'reveal-mask');
      } else if (req.body?.rect) {
        station.revealMask = { type: 'rect', rect: rectFromBody(req.body.rect) };
        writeEnvironmentLayout(layout, 'reveal-mask');
      }
      const revealObject = await linkRevealObjectFromUrl({
        layout,
        envDir,
        station,
        sourceUrl: String(req.body?.url ?? '').trim(),
      });
      res.json({
        ok: true,
        revealObject,
        ...environmentDetail(layout.id),
        cacheBust: Date.now(),
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/extract-missing-reveal-objects', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      const directScenePath = path.join(envDir, 'review', 'direct_scene.png');
      if (!fs.existsSync(directScenePath)) throw new Error('Generate a direct full-scene image first.');
      const missing = (layout.stations ?? []).filter((station) => {
        if (!station.revealMask) return false;
        if (!station.revealObjectAssetKey) return true;
        return !fs.existsSync(revealObjectPathForAsset(envDir, station.revealObjectAssetKey));
      });
      const concurrency = Math.max(1, Math.min(4, Math.round(Number(req.body?.concurrency ?? 2))));
      const results = await mapConcurrent(missing, concurrency, async (station) => {
        try {
          return {
            ok: true,
            ...(await extractRevealObjectForStation({ layout, art, envDir, station, body: req.body, persistLayout: false })),
          };
        } catch (error) {
          return {
            ok: false,
            stationId: station.id,
            error: error instanceof Error ? error.message : 'Extraction failed.',
          };
        }
      });
      const successes = results.filter((result) => result?.ok);
      const failures = results.filter((result) => result && !result.ok);
      if (successes.length > 0) writeEnvironmentLayout(layout, 'reveal-object-batch');
      res.json({
        ok: true,
        extractedCount: successes.length,
        failedCount: failures.length,
        revealObjects: successes,
        failures,
        ...environmentDetail(layout.id),
        cacheBust: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/generate-placed', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      const assetKey = levelAssetKey(station, req.body);
      const rect = req.body?.rect ? rectFromBody(req.body) : station.hitbox;
      const basePath = path.join(envDir, 'base.png');
      if (!fs.existsSync(basePath)) throw new Error('Generate a base environment first.');
      const guidePath = path.join(TMP_DIR, 'environment-designer', `${layout.id}-${assetKey}-placement.png`);
      ensureDir(path.dirname(guidePath));
      await run(PYTHON, [
        'scripts/environment-designer-tools.py',
        'guide',
        '--base',
        basePath,
        '--rect',
        JSON.stringify(rect),
        '--label',
        `${station.label} ${assetKey}`,
        '--out',
        guidePath,
      ]);
      const prompt = [
        `Edit the base environment by adding exactly one ${station.label} object inside the highlighted rectangle.`,
        `Station id: ${station.id}. Asset key: ${assetKey}.`,
        stationPrompt(art, station),
        art.propInstructions,
        'Match the existing room camera angle, scale, lighting, shadows, and floor/wall perspective.',
        'The object must fit fully inside the rectangle and appear naturally placed in that exact space.',
        'Do not alter the rest of the room. No readable text, no people, no UI, no watermark.',
      ]
        .filter(Boolean)
        .join(' ');
      const generatedUrl = await generateAsset({
        prompt,
        referencePath: basePath,
        guidePath,
        outputName: `${layout.id}-${assetKey}-placed`,
        model: req.body?.model === 'nano' ? 'nano' : 'gpt',
        imageSize: layout.plate?.width ?? 1536,
      });
      const reviewPath = path.join(envDir, 'review', `${assetKey}_placed.png`);
      backupEnvironmentFile(reviewPath, assetKey);
      await download(generatedUrl, reviewPath);
      res.json({ ok: true, placed: { path: repoRelative(reviewPath), url: `/${repoRelative(reviewPath)}` }, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/extract', async (req, res) => {
    try {
      const { layout, envDir } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      const assetKey = levelAssetKey(station, req.body);
      const rect = req.body?.rect ? rectFromBody(req.body) : station.hitbox;
      const placedPath = assertInside(
        req.body?.placedPath ? resolveRepoPath(req.body.placedPath) : path.join(envDir, 'review', `${assetKey}_placed.png`),
        envDir
      );
      if (!fs.existsSync(placedPath)) throw new Error('Generate a placed-object preview first.');
      const workDir = path.join(TMP_DIR, 'environment-designer');
      ensureDir(workDir);
      const cropPath = path.join(workDir, `${assetKey}-crop.png`);
      await run(PYTHON, [
        'scripts/environment-designer-tools.py',
        'crop',
        '--input',
        placedPath,
        '--rect',
        JSON.stringify(rect),
        '--pad',
        String(req.body?.pad ?? 64),
        '--out',
        cropPath,
      ]);
      const mattedPath = await matteImage(cropPath, assetKey);
      const finalPath = path.join(envDir, 'props', `${assetKey}.png`);
      backupEnvironmentFile(finalPath, assetKey);
      await run(PYTHON, [
        'scripts/environment-designer-tools.py',
        'fit',
        '--input',
        mattedPath,
        '--width',
        String(station.art?.width ?? rect.w),
        '--height',
        String(station.art?.height ?? rect.h),
        '--out',
        finalPath,
      ]);
      res.json({ ok: true, final: { path: repoRelative(finalPath), url: `/${repoRelative(finalPath)}` }, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/fit', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      const assetKey = levelAssetKey(station, req.body);
      const rect = req.body?.rect ? rectFromBody(req.body) : station.hitbox;
      await updateStationPlacement(layout, station, rect);

      const basePath = basePathForEnvironment(envDir);
      if (!basePath) throw new Error('Generate a base environment first.');
      const propPath = propPathForAsset(envDir, assetKey, true);
      if (!propPath) throw new Error('Generate or extract a transparent prop before fitting.');

      const workDir = path.join(TMP_DIR, 'environment-designer');
      ensureDir(workDir);
      const baseCropPath = path.join(workDir, `${layout.id}-${assetKey}-fit-base.png`);
      const guideCropPath = path.join(workDir, `${layout.id}-${assetKey}-fit-guide.png`);
      const pad = Number.isFinite(Number(req.body?.pad)) ? Math.max(16, Math.round(Number(req.body.pad))) : 96;
      await run(PYTHON, [
        'scripts/environment-designer-tools.py',
        'compose-fit-input',
        '--base',
        basePath,
        '--prop',
        propPath,
        '--rect',
        JSON.stringify(rect),
        '--pad',
        String(pad),
        '--out-base',
        baseCropPath,
        '--out-guide',
        guideCropPath,
      ]);

      const prompt = [
        `Refit this ${station.label} object into the cropped environment so it is naturally planted in the scene.`,
        `Preserve the same object identity, silhouette, approximate size, and placement shown in the guide image.`,
        stationPrompt(art, station),
        'Improve grounding, contact shadow, perspective alignment, lighting, and edge integration.',
        'Do not redesign the room. Do not add extra objects, readable text, people, UI, or watermark.',
        'Return the same crop view with the fitted object integrated into the environment.',
      ]
        .filter(Boolean)
        .join(' ');

      const imageSize = Math.min(1536, Math.max(1024, rect.w + pad * 2, rect.h + pad * 2));
      const generatedUrl = await generateAsset({
        prompt,
        referencePath: baseCropPath,
        guidePath: guideCropPath,
        outputName: `${layout.id}-${assetKey}-fitted`,
        model: req.body?.model === 'nano' ? 'nano' : 'gpt',
        imageSize,
      });

      const fittedPath = path.join(envDir, 'review', `${assetKey}_fitted.png`);
      backupEnvironmentFile(fittedPath, assetKey);
      await download(generatedUrl, fittedPath);

      const mattedPath = await matteImage(fittedPath, `${assetKey}-candidate`);
      const candidatePath = path.join(envDir, 'review', `${assetKey}_candidate.png`);
      backupEnvironmentFile(candidatePath, assetKey);
      await run(PYTHON, [
        'scripts/environment-designer-tools.py',
        'extract-fit-candidate',
        '--input',
        mattedPath,
        '--width',
        String(station.art?.width ?? rect.w),
        '--height',
        String(station.art?.height ?? rect.h),
        '--out',
        candidatePath,
      ]);

      res.json({
        ok: true,
        fitted: { path: repoRelative(fittedPath), url: `/${repoRelative(fittedPath)}` },
        candidate: { path: repoRelative(candidatePath), url: `/${repoRelative(candidatePath)}` },
        ...environmentDetail(layout.id),
        cacheBust: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/stations/:stationId/apply-fit', async (req, res) => {
    try {
      const { layout, envDir } = readEnvironment(req.params.id);
      const station = findStation(layout, req.params.stationId);
      const assetKey = levelAssetKey(station, req.body);
      const candidatePath = assertInside(path.join(envDir, 'review', `${assetKey}_candidate.png`), envDir);
      if (!fs.existsSync(candidatePath)) throw new Error('Run Fit Object first to create a candidate.');
      const finalPath = path.join(envDir, 'props', `${assetKey}.png`);
      backupEnvironmentFile(finalPath, assetKey);
      ensureDir(path.dirname(finalPath));
      fs.copyFileSync(candidatePath, finalPath);
      res.json({ ok: true, final: { path: repoRelative(finalPath), url: `/${repoRelative(finalPath)}` }, ...environmentDetail(layout.id), cacheBust: Date.now() });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/bake-scene', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      const basePath = basePathForEnvironment(envDir);
      if (!basePath) throw new Error('Generate a base environment first.');

      const objects = sceneObjectList(layout, art, envDir);
      if (objects.length === 0) throw new Error('Add environment objects before baking a scene.');

      const objectLines = objects.map((item, index) => {
        const rect = item.rect ?? {};
        return `${index + 1}. ${item.label} (${item.kind || 'station'}) in rectangle x=${rect.x}, y=${rect.y}, w=${rect.w}, h=${rect.h}: ${item.prompt}`;
      });
      const prompt = [
        'Create one final baked full-scene image from the provided base environment reference.',
        effectivePrompt(req.body?.prompt, art.basePrompt),
        'Use only the base image as the visual reference. Do not copy or imitate any separate prop reference images.',
        'Design every object fresh from the text list below and place each object naturally in its listed rectangle.',
        'The rectangles are approximate placement zones, not hard crop boxes. Let objects sit naturally on floors, walls, shelves, or counters where appropriate.',
        'Render all listed objects as native parts of the environment, not as pasted overlays or isolated cutouts.',
        'Integrate contact shadows, lighting, perspective, occlusion, scale, and material finish so the scene feels like one coherent illustration painted at once.',
        'Preserve the base room layout, camera angle, square framing, and open readability. Do not add people, UI, watermarks, or readable text.',
        'Object list:',
        objectLines.join(' '),
      ]
        .filter(Boolean)
        .join(' ');

      const generatedUrl = await generateAsset({
        prompt,
        referencePath: basePath,
        outputName: `${layout.id}-baked-scene`,
        model: req.body?.model === 'nano' ? 'nano' : 'gpt',
        imageSize: layout.plate?.width ?? 1536,
      });

      const bakedPath = path.join(envDir, 'review', 'baked_scene.png');
      backupEnvironmentFile(bakedPath, 'baked-scene');
      await download(generatedUrl, bakedPath);
      const promptPath = path.join(envDir, 'review', 'baked_scene_prompt.txt');
      backupEnvironmentFile(promptPath, 'baked-scene-prompt');
      fs.writeFileSync(promptPath, `${prompt}\n`);
      res.json({
        ok: true,
        bakedScene: { path: repoRelative(bakedPath), url: `/${repoRelative(bakedPath)}` },
        ...environmentDetail(layout.id),
        cacheBust: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.post('/api/environments/:id/direct-scene-pipeline', async (req, res) => {
    try {
      const { layout, art, envDir } = readEnvironment(req.params.id);
      ensureDir(envDir);
      const referencePath = fs.existsSync(STYLE_REFERENCE_PATH) ? STYLE_REFERENCE_PATH : basePathForEnvironment(envDir);
      if (!referencePath) throw new Error('No style reference or base image exists.');

      const stations = layout.stations ?? [];
      if (stations.length === 0) throw new Error('Add environment objects before generating a direct scene.');
      const stationLines = stations.map((station, index) => `${index + 1}. ${station.label}: ${sceneStationPrompt(art, station)}`);
      const scenePrompt = [
        `Create a complete final populated ${layout.domain || 'themed'} home environment scene as one coherent square isometric illustration.`,
        effectivePrompt(req.body?.prompt, art.basePrompt),
        art.stylePrompt,
        'Use the provided image only as the art-style reference for rounded 3D mobile-game materials, lighting, palette, and camera feel. Do not copy its layout.',
        'Use back and side walls only, with an open front cutaway so the floor and objects are visible.',
        'Populate the room naturally with the following persistent upgrade stations, designed from scratch as part of the scene.',
        'Do not use pasted objects, isolated cutouts, separate object references, UI, watermarks, people, or readable text.',
        'Keep all objects grounded with matching contact shadows, scale, perspective, material finish, and warm lighting. Leave enough open floor space for readability.',
        'Station list:',
        stationLines.join(' '),
        art.negativePrompt,
      ]
        .filter(Boolean)
        .join(' ');

      const directUrl = await generateAsset({
        prompt: scenePrompt,
        referencePath,
        outputName: `${layout.id}-direct-scene`,
        model: req.body?.model === 'nano' ? 'nano' : 'gpt',
        imageSize: layout.plate?.width ?? 1536,
      });

      const directPath = path.join(envDir, 'review', 'direct_scene.png');
      backupEnvironmentFile(directPath, 'direct-scene');
      await download(directUrl, directPath);
      const scenePromptPath = path.join(envDir, 'review', 'direct_scene_prompt.txt');
      backupEnvironmentFile(scenePromptPath, 'direct-scene-prompt');
      fs.writeFileSync(scenePromptPath, `${scenePrompt}\n`);

      const removableObjects = stations.map((station) => station.label).join(', ');
      const basePrompt = [
        'Edit this populated final environment into a clean reusable base environment image.',
        'Remove every discrete upgrade station object and station contents from the scene.',
        `Objects to remove include: ${removableObjects}.`,
        'Also remove movable food, trophies, maps, notice boards, photo cards, display cases, tables, pots, racks, shelves full of jars, and other prop clutter that belongs to those stations.',
        'Preserve the room architecture, walls, floor, hearth/fireplace structures, lighting direction, camera angle, square framing, and open-front cutaway.',
        'Where objects were removed, leave clean empty placement sockets, open floor pads, empty wall shelf zones, or unobstructed floor/wall surfaces that match the surrounding material.',
        'The result should look like a deliberately designed empty base scene ready for dynamic props, not a damaged or blurred object-removal edit.',
        'No people, no readable text, no UI, no watermark.',
      ].join(' ');

      const extractedUrl = await generateAsset({
        prompt: basePrompt,
        referencePath: directPath,
        outputName: `${layout.id}-extracted-base`,
        model: req.body?.model === 'nano' ? 'nano' : 'gpt',
        imageSize: layout.plate?.width ?? 1536,
      });

      const extractedPath = path.join(envDir, 'review', 'extracted_base.png');
      backupEnvironmentFile(extractedPath, 'extracted-base');
      await download(extractedUrl, extractedPath);
      const basePromptPath = path.join(envDir, 'review', 'extracted_base_prompt.txt');
      backupEnvironmentFile(basePromptPath, 'extracted-base-prompt');
      fs.writeFileSync(basePromptPath, `${basePrompt}\n`);

      res.json({
        ok: true,
        directScene: { path: repoRelative(directPath), url: `/${repoRelative(directPath)}` },
        extractedBase: { path: repoRelative(extractedPath), url: `/${repoRelative(extractedPath)}` },
        ...environmentDetail(layout.id),
        cacheBust: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/catalog', (_req, res) => {
    const catalog = readJson(CATALOG_PATH);
    const layout = readJson(LAYOUT_PATH);
    res.json({
      catalog,
      layout,
      discoveredAssets: discoverWorldObjectAssets(),
      validation: validateDesignData(catalog, layout),
    });
  });

  app.get('/api/layout', (_req, res) => {
    res.json(readJson(LAYOUT_PATH));
  });

  app.post('/api/catalog', (req, res) => {
    try {
      const nextCatalog = req.body;
      const result = saveCatalog(nextCatalog);
      return res.json({ ok: true, catalog: nextCatalog, ...result });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message, validation: error.validation });
    }
  });

  app.post('/api/layout', (req, res) => {
    const catalog = readJson(CATALOG_PATH);
    const nextLayout = req.body;
    const validation = validateDesignData(catalog, nextLayout);
    if (!validation.ok) return res.status(400).json(validation);
    ensureDir(BACKUP_DIR);
    const backupPath = path.join(BACKUP_DIR, 'layout', `world-structure-layout-${stamp()}.json`);
    ensureDir(path.dirname(backupPath));
    fs.copyFileSync(LAYOUT_PATH, backupPath);
    fs.writeFileSync(LAYOUT_PATH, `${JSON.stringify(nextLayout, null, 2)}\n`);
    return res.json({ ok: true, validation, backup: repoRelative(backupPath), layout: nextLayout });
  });

  app.post('/api/validate', (req, res) => {
    const catalog = req.body?.catalog ?? readJson(CATALOG_PATH);
    const layout = req.body?.layout ?? readJson(LAYOUT_PATH);
    res.json(validateDesignData(catalog, layout));
  });

  app.post('/api/asset-slot', (req, res) => {
    try {
      const catalog = readJson(CATALOG_PATH);
      const family = findFamily(catalog, req.body?.familyId);
      if (!family) return res.status(404).json({ ok: false, error: 'Unknown family.' });
      const sourcePath = String(req.body?.sourcePath ?? '');
      assertInside(resolveRepoPath(sourcePath), WORLD_ASSET_DIR);
      if (req.body?.mode === 'variant') {
        const variantNumber = (family.assets ?? []).length + 1;
        const variant = {
          assetKey: uniqueAssetKey(family, sourcePath),
          label: `Variant ${variantNumber}`,
          state: `variant-${variantNumber}`,
          path: repoRelative(resolveRepoPath(sourcePath)),
        };
        family.assets = [...(family.assets ?? []), variant];
        const saved = saveCatalog(catalog);
        return res.json({
          ok: true,
          mode: 'variant',
          newAsset: variant,
          catalog,
          discoveredAssets: discoverWorldObjectAssets(),
          cacheBust: Date.now(),
          ...saved,
        });
      }
      const asset = findAsset(family, req.body?.assetKey);
      if (!asset) return res.status(404).json({ ok: false, error: 'Unknown asset.' });
      const backups = copySelectedArtIntoSlot(asset, sourcePath);
      return res.json({
        ok: true,
        mode: 'replace',
        backups,
        catalog,
        discoveredAssets: discoverWorldObjectAssets(),
        cacheBust: Date.now(),
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message, validation: error.validation });
    }
  });

  app.post('/api/regenerate', async (req, res) => {
    try {
      const catalog = readJson(CATALOG_PATH);
      const family = findFamily(catalog, req.body?.familyId);
      if (!family) return res.status(404).json({ ok: false, error: 'Unknown family.' });
      const scope = req.body?.scope === 'family' ? 'family' : 'selected';
      const prompt = String(req.body?.prompt ?? family.prompt ?? '').trim();
      let result;
      if (scope === 'family') {
        result = await regenerateFamily(family, prompt);
      } else {
        const asset = findAsset(family, req.body?.assetKey);
        if (!asset) return res.status(404).json({ ok: false, error: 'Unknown asset.' });
        result = await regenerateSelected(asset, prompt);
      }
      res.json({
        ok: true,
        backups: result.backups,
        stdout: result.output.stdout,
        stderr: result.output.stderr,
        cacheBust: Date.now(),
        assets: discoverWorldObjectAssets().map((asset) => ({ ...asset, url: `${asset.url}?v=${Date.now()}` })),
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: path.join(ROOT, 'tools', 'world-editor'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, () => {
    console.log(`World editor: http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
