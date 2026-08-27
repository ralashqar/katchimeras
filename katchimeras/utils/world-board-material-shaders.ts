import { Skia } from '@shopify/react-native-skia';

const VALUE_NOISE = `
float hash21(float2 value) {
  value = fract(value * float2(123.34, 456.21));
  value += dot(value, value + 45.32);
  return fract(value.x * value.y);
}

float valueNoise(float2 value) {
  float2 cell = floor(value);
  float2 local = fract(value);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + float2(1.0, 0.0));
  float c = hash21(cell + float2(0.0, 1.0));
  float d = hash21(cell + float2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}
`;

export const WORLD_BOARD_SURFACE_SHADER_SOURCE = `
uniform float3 baseColor;
uniform float3 shadowColor;
uniform float3 highlightColor;
uniform float seed;
uniform float opacity;
${VALUE_NOISE}

half4 main(float2 position) {
  float2 seedOffset = float2(seed * 0.071, seed * 0.113);
  float broad = valueNoise(position * 0.22 + seedOffset);
  float secondary = valueNoise(position * 0.58 + seedOffset + float2(5.3, 8.7));
  float variation = broad * 0.72 + secondary * 0.28;
  float warmLift = smoothstep(0.34, 0.82, variation);
  float coolShade = smoothstep(0.58, 0.12, variation);
  float3 color = baseColor;
  color = mix(color, highlightColor, warmLift * 0.18);
  color = mix(color, shadowColor, coolShade * 0.12);
  float grain = hash21(position * 31.0 + seedOffset) - 0.5;
  color *= 1.0 + grain * 0.012;
  return half4(half3(color * opacity), half(opacity));
}
`;

export const WORLD_BOARD_GRID_SHADER_SOURCE = `
uniform float3 seamColor;
uniform float checkerOpacity;
uniform float checkerInset;
uniform float checkerRadius;

half4 main(float2 position) {
  float2 tile = fract(position) - float2(0.5);
  float2 halfSize = float2(0.5 - checkerInset);
  float2 rounded = abs(tile) - (halfSize - float2(checkerRadius));
  float roundedDistance = length(max(rounded, float2(0.0)))
    + min(max(rounded.x, rounded.y), 0.0)
    - checkerRadius;
  float roundedMask = 1.0 - smoothstep(-0.004, 0.004, roundedDistance);
  float checker = mod(floor(position.x) + floor(position.y), 2.0);
  float alpha = checker * roundedMask * checkerOpacity;
  return half4(half3(seamColor * alpha), half(alpha));
}
`;

export const WORLD_BOARD_DEPTH_SHADER_SOURCE = `
uniform float3 stoneColor;
uniform float3 mortarColor;
uniform float3 mossColor;
uniform float2 faceNormal;
uniform float3 lightDirection;
uniform float seed;
${VALUE_NOISE}

half4 main(float2 wallUv) {
  const float rows = 3.0;
  const float blockWidth = 0.56;
  float row = floor(wallUv.y * rows);
  float stagger = mod(row, 2.0) * 0.5;
  float2 blockPosition = float2(wallUv.x / blockWidth + stagger, wallUv.y * rows);
  float2 blockId = floor(blockPosition);
  float2 local = fract(blockPosition);
  float radius = 0.105;
  float2 rounded = abs(local - float2(0.5)) - float2(0.5 - radius);
  float blockSdf = min(max(rounded.x, rounded.y), 0.0) + length(max(rounded, float2(0.0))) - radius;
  float mortar = smoothstep(-0.055, 0.005, blockSdf);
  float blockNoise = hash21(blockId + float2(seed * 0.17, seed * 0.29));
  float broadNoise = valueNoise(float2(wallUv.x * 0.42, wallUv.y * 2.2) + seed * 0.03);
  float3 wallNormal = normalize(float3(faceNormal, 0.12));
  float diffuse = max(dot(wallNormal, normalize(lightDirection)), 0.0);
  float directional = 0.80 + diffuse * 0.20;
  float verticalShade = mix(1.04, 0.76, smoothstep(0.0, 1.0, wallUv.y));
  float3 blockColor = stoneColor * (0.91 + blockNoise * 0.13 + broadNoise * 0.035);
  float3 color = mix(blockColor, mortarColor, mortar * 0.78);
  float topCap = 1.0 - smoothstep(0.0, 0.10, wallUv.y);
  color += float3(1.0, 0.84, 0.48) * topCap * 0.065;
  float moss = (1.0 - smoothstep(0.0, 0.20, wallUv.y)) * (0.07 + broadNoise * 0.10);
  color = mix(color, mossColor, moss);
  color *= directional * verticalShade;
  return half4(half3(color), 1.0);
}
`;

export const WORLD_BOARD_SURFACE_EFFECT = Skia.RuntimeEffect.Make(WORLD_BOARD_SURFACE_SHADER_SOURCE);
export const WORLD_BOARD_GRID_EFFECT = Skia.RuntimeEffect.Make(WORLD_BOARD_GRID_SHADER_SOURCE);
export const WORLD_BOARD_DEPTH_EFFECT = Skia.RuntimeEffect.Make(WORLD_BOARD_DEPTH_SHADER_SOURCE);

if (__DEV__) {
  if (!WORLD_BOARD_SURFACE_EFFECT) console.error('World board surface SkSL failed to compile.');
  if (!WORLD_BOARD_GRID_EFFECT) console.error('World board grid SkSL failed to compile.');
  if (!WORLD_BOARD_DEPTH_EFFECT) console.error('World board depth SkSL failed to compile.');
}
