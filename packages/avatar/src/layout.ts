export type LayerPresentation = {scale:number;offsetX:number;offsetY:number};
export function centeredLayerStyle(scale: number, offsetX = 0, offsetY = 0) {
  const size = `${scale * 100}%` as `${number}%`;
  const left = `${((1 - scale) / 2 + offsetX) * 100}%` as `${number}%`;
  const top = `${((1 - scale) / 2 + offsetY) * 100}%` as `${number}%`;
  return { bottom: undefined, height: size, left, position: 'absolute' as const, right: undefined, top, width: size };
}


export function composeLayerPresentation(body: LayerPresentation, residual: LayerPresentation): LayerPresentation {
 return {scale:body.scale*residual.scale,offsetX:body.offsetX+residual.offsetX,offsetY:body.offsetY+residual.offsetY};
}
