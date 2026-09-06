/** 20% headroom avoids under-resolving broad beveled edges near a threshold. */
export function worldTileImageLod(width: number, settledScale: number, pixelRatio: number): 'thumb' | 'medium' | 'full' {
  const pixels = width * settledScale * pixelRatio * 1.2;
  return pixels <= 256 ? 'thumb' : pixels <= 512 ? 'medium' : 'full';
}
