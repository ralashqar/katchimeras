import type { HomeDayRecord } from '@/types/home';
import { buildComicStrip } from '@/utils/day-comic';
import { requestComicBeats } from '@/utils/day-reflection';
import { getCreatureVisual } from '@/game/days';
import { resolveBundledImageDataUri } from '@/utils/asset-data-uri';
import { getCombinedThumbnailDataUri, getPhotoThumbnailDataUri } from '@/utils/photo-vision';
import { supabase } from '@/utils/supabase';
import type { OnboardingProfile } from '@/utils/onboarding-state';

// Renders the day as ONE finished comic page via the generate-day-comic edge
// function (FAL GPT-Image): the day's real photos + the creature cutout go in as
// input images, and the model bakes panels, captions, and speech bubbles into a
// single A4 page. This is a deliberate, opt-in share action — the photos leave
// the device (unlike the rest of the app), so the caller must gate it on consent.

type HatchedDay = HomeDayRecord & { creature: NonNullable<HomeDayRecord['creature']> };

export type ComicRenderResult = { imageUrl: string } | { error: string };

const CAMERA_ROLL_PREFIX = 'camera-roll-photo-';
const COMIC_PHOTO_COUNT = 4; // sample photos sent as scene references
const COMIC_PHOTO_MAX_SIZE = 768;
const COMBINED_MAX_SIZE = 1024;
// GPT Image 2 with several reference images regularly runs past 2 minutes; the
// backend often finishes after the client gave up. Give it a wide margin.
const COMIC_TIMEOUT_MS = 240_000;

// Switchable image model — flip COMIC_MODEL to compare. nano-banana-2 (Gemini)
// tends to look more natural / cartoony; gpt-image-2 follows text more literally.
const COMIC_MODELS = {
  nanoBanana: 'fal-ai/nano-banana-2/edit',
  gptImage: 'openai/gpt-image-2/edit',
} as const;
const COMIC_MODEL: string = COMIC_MODELS.nanoBanana;
// Send ONE combined grid image instead of N separate photos. Needs the native
// build; falls back to separate photos when the combine function isn't present.
const COMIC_COMBINE_PHOTOS = true;

export async function renderDayComic(
  day: HatchedDay,
  profile: OnboardingProfile
): Promise<ComicRenderResult> {
  // 1. TEXT — reuse the LLM comic beats (falls back to local templated beats),
  //    structured into a title + four panel captions by buildComicStrip.
  let beats = null;
  try {
    beats = await requestComicBeats(day, profile);
  } catch {
    beats = null;
  }
  const strip = buildComicStrip(day, beats);
  if (!strip) {
    return { error: 'This day has not hatched yet.' };
  }

  // 2. PHOTOS — a few curated keepers from the day's place clusters, read as
  //    resized JPEG data URIs (native; reliable for HEIC / iCloud photos).
  //    Optionally combined into ONE grid reference image.
  const assetIds = collectComicPhotoAssetIds(day, COMIC_PHOTO_COUNT);
  let photoDataUris: string[] = [];
  let photosCombined = false;
  if (COMIC_COMBINE_PHOTOS && assetIds.length > 1) {
    const combined = await getCombinedThumbnailDataUri(assetIds, COMBINED_MAX_SIZE);
    if (combined) {
      photoDataUris = [combined];
      photosCombined = true;
    }
  }
  if (photoDataUris.length === 0) {
    // Separate photos — also the fallback when the combine fn isn't in the build.
    photoDataUris = (
      await Promise.all(assetIds.map((id) => getPhotoThumbnailDataUri(id, COMIC_PHOTO_MAX_SIZE)))
    ).filter((uri): uri is string => uri != null);
  }

  // A comic without the day's real photos is just the invented-scene case the
  // user is complaining about, so fail LOUDLY instead of silently sending only
  // the creature. Tells us whether the day had no photos, or the native reader
  // (thumbnailBase64Async) isn't in this build (needs a dev-client rebuild).
  if (photoDataUris.length === 0) {
    return {
      error:
        assetIds.length === 0
          ? 'This day has no photos to build a comic from.'
          : `Couldn't read this day's photos (found ${assetIds.length}). If you just updated the app, rebuild the dev client — the native photo reader isn't in this build.`,
    };
  }

  // 3. CREATURE — the bundled cutout as a data URI, so the model can feature the
  //    exact character.
  const creatureVisual = getCreatureVisual(day.creature.visualKey);
  const creatureDataUri = await resolveBundledImageDataUri(creatureVisual.source);

  const imageUrls = [...photoDataUris];
  if (creatureDataUri) {
    imageUrls.push(creatureDataUri);
  }

  // 4. PROMPT — Pixar-style A4 comic, baked captions + speech bubbles.
  const momentCount = photosCombined ? Math.min(assetIds.length, COMIC_PHOTO_COUNT) : photoDataUris.length;
  const prompt = buildComicPrompt(day, strip, momentCount, Boolean(creatureDataUri), photosCombined);

  // 5. RENDER.
  try {
    const invocation = supabase.functions.invoke('generate-day-comic', {
      body: { prompt, imageUrls, quality: 'medium', modelId: COMIC_MODEL, dayId: day.id },
    });
    const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), COMIC_TIMEOUT_MS);
    });
    const result = await Promise.race([invocation, timeout]);

    if (!result || result.error) {
      return { error: `Comic generation failed${result?.error ? `: ${result.error.message}` : ''}.` };
    }
    const imageUrl = (result.data as { imageUrl?: unknown } | null)?.imageUrl;
    if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
      return { error: 'Comic generation returned no image.' };
    }
    return { imageUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Comic generation failed.' };
  }
}

// The day's curated album photos (already black/dup filtered), one per place
// cluster first for variety, deduped, capped — returned as raw asset ids.
function collectComicPhotoAssetIds(day: HomeDayRecord, limit: number): string[] {
  const nodes = day.dayMap?.nodes ?? [];
  const ids: string[] = [];
  const seen = new Set<string>();
  if (day.heroPhoto?.assetId) {
    seen.add(day.heroPhoto.assetId);
    ids.push(day.heroPhoto.assetId);
  }

  // Round 1: the first photo from each place (spread across the day).
  for (const node of nodes) {
    const first = node.photos[0];
    if (first) {
      pushAssetId(first.id, ids, seen);
    }
  }
  // Round 2: fill from the rest until we hit the limit.
  for (const node of nodes) {
    for (const photo of node.photos.slice(1)) {
      if (ids.length >= limit) break;
      pushAssetId(photo.id, ids, seen);
    }
  }

  return ids.slice(0, limit);
}

function pushAssetId(pointId: string, ids: string[], seen: Set<string>) {
  if (!pointId.startsWith(CAMERA_ROLL_PREFIX)) {
    return;
  }
  const assetId = pointId.slice(CAMERA_ROLL_PREFIX.length);
  if (!assetId || seen.has(assetId)) {
    return;
  }
  seen.add(assetId);
  ids.push(assetId);
}

function buildComicPrompt(
  day: HatchedDay,
  strip: ReturnType<typeof buildComicStrip>,
  photoCount: number,
  hasCreature: boolean,
  combined = false
): string {
  const safeStrip = strip!;
  const creatureName = day.creature.name;
  const captions = safeStrip.panels.map((panel, index) => `Panel ${index + 1}: ${panel.caption}`).join('\n');
  const sceneNote =
    photoCount <= 0
      ? `Invent gentle everyday scenes for the panels.`
      : combined
        ? `The attached photo is a collage of ${photoCount} moments from this person's actual day. Base the characters loosely on the people shown in it — a light resemblance (similar hair, skin tone, and outfit), drawn as friendly 3D Pixar-style cartoon characters, not realistic. Set the panels in the real places shown in the collage.`
        : `Base the characters loosely on the people in the first ${photoCount} attached photo${photoCount === 1 ? '' : 's'} — a light resemblance (similar hair, skin tone, and outfit), drawn as friendly 3D Pixar-style cartoon characters, not realistic. Set the panels in the real places from those photos.`;
  const creatureNote = hasCreature
    ? `The last attached image is the mascot ${creatureName} — match the page to its soft, cute cartoon style and feature it as the companion in several panels.`
    : `Include a small friendly cartoon companion named ${creatureName} in several panels.`;

  return [
    `Create ONE finished comic-book PAGE, A4 portrait, in a soft, cute 3D Pixar-style cartoon look (rounded shapes, smooth shading, warm and playful). Not photorealistic.`,
    `Lay it out as a clean multi-panel strip: a title banner at the top, then 4 panels with gutters, telling the arc of one person's day.`,
    sceneNote,
    creatureNote,
    `Render the text inside the image, short and legible: the title "${safeStrip.title} — ${safeStrip.subtitle}", a caption box per panel, and a couple of playful speech bubbles from ${creatureName}.`,
    `Panel captions:`,
    captions,
    `Warm and shareable. No watermarks.`,
  ].join('\n');
}
