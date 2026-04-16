# Katchimera Day Map Design

This document is the canonical product and implementation brief for the Day Map MVP.

Related references:

- `docs/katchimera-app-mvp-design.md`
- `docs/home-screen-ux-and-katchimera-design-system.md`
- `docs/mvp-implementation-plan.md`

## 1. Product Summary

The Day Map adds a spatial layer to the existing daily reflection loop.

It is not:

- navigation
- live tracking
- raw GPS playback

It is:

- a memory map of where the day happened
- a quiet visual companion to the creature and highlight

## 2. MVP Scope

Ship:

- single-day map only
- Home-owned preview on past days
- dedicated full-screen day map route
- foreground-only capture while the app is open
- local-first persistence inside the current Home state

Do not ship in MVP:

- global map
- background location
- heatmaps
- raw coordinate labels
- search or place editing

## 3. UX Structure

### Home integration

For past days, the Home flow becomes:

- Creature
- Highlight
- Day Map preview
- Moments list

The preview stays compact and non-technical. The CTA is `View day map`.

### Full-screen route

`/day-map/[dayId]` renders the same day in a larger interactive map.

The full-screen route supports:

- glowing place nodes
- soft connecting path
- primary-location emphasis
- tap node for detail card
- tap map to dismiss detail

## 4. Data Model

### Stored point

```json
{
  "id": "string",
  "lat": 0,
  "lng": 0,
  "capturedAt": "ISO-8601",
  "type": "home | cafe | park | unknown",
  "hasPhoto": false,
  "source": "foreground",
  "momentId": "string | null"
}
```

### Derived day map

```json
{
  "nodes": [],
  "path": [],
  "primaryLocationId": "string | null",
  "viewport": {
    "latitude": 0,
    "longitude": 0,
    "latitudeDelta": 0,
    "longitudeDelta": 0
  },
  "totalSamples": 0
}
```

## 5. Processing Rules

1. Capture foreground samples only while Home is focused on today.
2. De-duplicate near-identical consecutive samples before storing.
3. Cluster samples within `150m`.
4. Score clusters using dwell span, sample count, and photo or moment links.
5. Keep at most `5` key locations.
6. Order retained nodes chronologically.
7. Build a smoothed path between nodes.
8. Choose primary location by:
   photo-linked first
   longest dwell second
   earliest fallback last

## 6. Spatial And Moment Linking

Photo and `new_place` moments should reinforce the day map instead of creating a separate timeline.

MVP behavior:

- when a fresh location sample exists, attach the new moment to the latest sample
- photo moments mark the location as higher priority
- semantic moment types can coarsely influence place type
- if no fresh sample exists, the moment still saves normally

## 7. Visual Direction

- use a light, low-detail map base
- render locations as glowing orbs rather than literal pins
- use the creature or egg accent color as the map accent
- keep labels off the map itself
- use soft motion, not tracker-style activity chrome

## 8. Edge States

- no samples: `No places captured for this day`
- one cluster: show one node and no path
- noisy day: cluster and cap to five nodes
- denied permission: do not block Home or moment capture

## 9. Current Implementation Shape

The current implementation uses:

- `expo-location` for foreground capture
- `react-native-maps` for native rendering
- local Home-state persistence with a `version: 2` migration
- a pure `utils/day-map-engine.ts` derivation layer shared by preview and full-screen map

## 10. Future Extensions

- global map aggregating many days
- background-aware day reconstruction
- repeated-place highlighting
- rare-place emphasis
- animated replay of day movement
