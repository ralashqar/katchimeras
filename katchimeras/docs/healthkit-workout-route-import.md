# HealthKit Workout Route Import

Katchimeras now supports an explicit iPhone-only `Import walk route` action on the Day Map preview.

## What it imports

- Apple Health workout routes only
- only for the selected day
- only when the workout has `HKWorkoutRoute` data

This does not read Apple's general location history.

## Current behavior

- The import CTA appears on iPhone only.
- First tap opens a short explainer.
- Confirming the action requests Apple Health read access when needed.
- When route data exists:
  - exact route segments are stored on the day for the full-screen map
  - sampled route points are merged into the day `locations[]` pipeline
  - sampled route points use `source: health_workout_route`
- Walking, running, and hiking routes are currently classified as `park`.
- Other workout route types are currently classified as `unknown`.

## Storage changes

- `StoredHomeState.version` is now `4`
- `StoredHomeState.healthPermission` tracks the local Health import permission state
- `StoredHomeState.activityPermission` tracks local step-permission state for the broader MVP loop
- each stored day now includes:
  - `healthRouteImport`
  - `exactRouteSegments`

## Rendering

- imported exact routes render as a subtle secondary polyline behind the existing emotional node/path layer
- the day map still centers the orb and memory-summary model first

## Build requirement

This feature requires a new iPhone development build because it adds:

- a local Expo native module
- an iOS config plugin
- the HealthKit entitlement
- `NSHealthShareUsageDescription`

Fast Refresh is not enough for this feature.
