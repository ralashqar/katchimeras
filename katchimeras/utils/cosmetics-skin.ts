// Cosmetic application layering. The renderer resolves a semantic object's look in
// a fixed precedence: user override → active world theme → default (a seasonal
// overlay can sit on top later). Pure + tiny so it's trivially testable and reused
// everywhere a cosmetic value is needed. See progression-customisation-design §6.

export type SkinLayers = {
  override?: string | null; // a per-object user choice (Phase E object skins)
  theme?: string | null; // value provided by the active world theme
  fallback?: string | null; // the natural/default value
  seasonal?: string | null; // a seasonal overlay value (future), wins when present
};

export function resolveSkin(layers: SkinLayers): string | undefined {
  return layers.seasonal ?? layers.override ?? layers.theme ?? layers.fallback ?? undefined;
}
