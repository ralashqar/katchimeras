import type { WispId } from '@/types/wisp';

export type WispAsset = { full: number; thumbnail: number };

export const WISP_ASSETS: Partial<Record<WispId, WispAsset>> = {
  sprout: { full: require('../assets/images/katchimeras/wisps/sprout.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/sprout.webp') },
  steam: { full: require('../assets/images/katchimeras/wisps/steam.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/steam.webp') },
  flash: { full: require('../assets/images/katchimeras/wisps/flash.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/flash.webp') },
  drizzle: { full: require('../assets/images/katchimeras/wisps/drizzle.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/drizzle.webp') },
  moonlit: { full: require('../assets/images/katchimeras/wisps/moonlit.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/moonlit.webp') },
  page: { full: require('../assets/images/katchimeras/wisps/page.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/page.webp') },
  wander: { full: require('../assets/images/katchimeras/wisps/wander.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/wander.webp') },
  heartlet: { full: require('../assets/images/katchimeras/wisps/heartlet.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/heartlet.webp') },
  sunset: { full: require('../assets/images/katchimeras/wisps/sunset.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/sunset.webp') },
  bloom: { full: require('../assets/images/katchimeras/wisps/bloom.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/bloom.webp') },
  pixel: { full: require('../assets/images/katchimeras/wisps/pixel.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/pixel.webp') },
  buddy: { full: require('../assets/images/katchimeras/wisps/buddy.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/buddy.webp') },
  crumb: { full: require('../assets/images/katchimeras/wisps/crumb.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/crumb.webp') },
  dream: { full: require('../assets/images/katchimeras/wisps/dream.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/dream.webp') },
  relic: { full: require('../assets/images/katchimeras/wisps/relic.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/relic.webp') },
  spark: { full: require('../assets/images/katchimeras/wisps/spark.webp'), thumbnail: require('../assets/images/katchimeras/wisps/thumbnails/spark.webp') },
};

export function wispAsset(id: WispId, thumbnail = false) {
  const asset = WISP_ASSETS[id];
  return asset ? (thumbnail ? asset.thumbnail : asset.full) : null;
}
