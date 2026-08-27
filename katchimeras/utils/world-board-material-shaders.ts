import { Skia } from '@shopify/react-native-skia';

export const WORLD_BOARD_SURFACE_SHADER_SOURCE = `
uniform shader material;
uniform float2 columnBasis;
uniform float2 rowBasis;
uniform float2 sceneOrigin;
uniform float bevelWidth;
uniform float antialiasWidth;
uniform float4 cornerRadii;
uniform float3 lightDirection;

float selectedCornerRadius(float2 centered) {
  return centered.x < 0.0
    ? (centered.y < 0.0 ? cornerRadii.x : cornerRadii.w)
    : (centered.y < 0.0 ? cornerRadii.y : cornerRadii.z);
}

float tileSdf(float2 uv) {
  float2 centered = uv - float2(0.5);
  float radius = selectedCornerRadius(centered);
  float2 q = abs(centered) - float2(0.5 - radius);
  return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - radius;
}

half4 main(float2 position) {
  float2 uv = fract(position);
  float sdf = tileSdf(uv);
  float coverage = 1.0 - smoothstep(-antialiasWidth, antialiasWidth, sdf);
  float distanceInside = max(-sdf, 0.0);
  float bevelProgress = smoothstep(0.0, bevelWidth, distanceInside);

  const float gradientStep = 0.0015;
  float2 gradient = float2(
    tileSdf(uv + float2(gradientStep, 0.0)) - tileSdf(uv - float2(gradientStep, 0.0)),
    tileSdf(uv + float2(0.0, gradientStep)) - tileSdf(uv - float2(0.0, gradientStep))
  );
  gradient = length(gradient) > 0.00001 ? normalize(gradient) : float2(0.0);
  float bevelSlope = 6.0 * bevelProgress * (1.0 - bevelProgress);
  float3 normal = normalize(float3(gradient * bevelSlope * 0.72, 1.0));
  float diffuse = max(dot(normal, normalize(lightDirection)), 0.0);
  float lighting = 0.80 + diffuse * 0.20;
  float edgeOcclusion = 1.0 - 0.11 * (1.0 - smoothstep(0.0, bevelWidth * 0.82, distanceInside));
  float warmRim = 0.045 * diffuse * smoothstep(0.05, 0.95, bevelSlope);

  float2 worldPosition = sceneOrigin + columnBasis * position.x + rowBasis * position.y;
  half4 base = material.eval(worldPosition);
  float3 shaded = float3(base.rgb) * lighting * edgeOcclusion + float3(1.0, 0.90, 0.58) * warmRim * base.a;
  return half4(half3(shaded * coverage), half(base.a * coverage));
}
`;

export const WORLD_BOARD_DEPTH_SHADER_SOURCE = `
uniform float4 baseColor;
uniform float4 mossColor;
uniform float2 faceNormal;
uniform float3 lightDirection;

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

half4 main(float2 wallUv) {
  float coarse = valueNoise(wallUv * float2(2.2, 3.1));
  float fine = valueNoise(wallUv * float2(5.4, 8.2) + float2(7.1, 3.7));
  float soilNoise = coarse * 0.68 + fine * 0.32;
  float strata = sin((wallUv.y * 12.0 + soilNoise * 0.75) * 3.14159265) * 0.018;
  float verticalShade = mix(1.02, 0.78, smoothstep(0.0, 1.0, wallUv.y));
  float3 wallNormal = normalize(float3(faceNormal, 0.12));
  float directional = 0.82 + 0.18 * max(dot(wallNormal, normalize(lightDirection)), 0.0);
  float variation = 0.94 + soilNoise * 0.10 + strata;
  float mossAmount = (1.0 - smoothstep(0.0, 0.18, wallUv.y)) * (0.08 + coarse * 0.08);
  float3 soil = baseColor.rgb * verticalShade * directional * variation;
  float3 color = mix(soil, mossColor.rgb, mossAmount);
  return half4(half3(color * baseColor.a), half(baseColor.a));
}
`;

export const WORLD_BOARD_SURFACE_EFFECT = Skia.RuntimeEffect.Make(WORLD_BOARD_SURFACE_SHADER_SOURCE);
export const WORLD_BOARD_DEPTH_EFFECT = Skia.RuntimeEffect.Make(WORLD_BOARD_DEPTH_SHADER_SOURCE);

if (__DEV__) {
  if (!WORLD_BOARD_SURFACE_EFFECT) console.error('World board surface SkSL failed to compile.');
  if (!WORLD_BOARD_DEPTH_EFFECT) console.error('World board depth SkSL failed to compile.');
}
