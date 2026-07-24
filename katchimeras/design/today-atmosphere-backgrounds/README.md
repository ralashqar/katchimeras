# Today atmosphere background pipeline

Ten bundled 9:16 scenic plates replace Today’s animated sky, cloud bank, and
procedural haze. They sit behind the daily floating environment, egg, and
Katchimera. Kingdom keeps its independent moving sky.

## Locked production rules

- Canvas: `945x1680`, RGB WebP quality 92, at most 650 KB.
- At least 80% of each plate is open sky, atmospheric haze, or soft clouds.
- The central 48% width stays quiet through the live environment staging area.
- Small distant floating cliff-islands may frame the side edges; together they
  occupy no more than 12% of the image.
- No terrestrial horizon, continuous ground, foreground island, creature, egg,
  tile, stage, path, nest, UI, text, or central prop.
- Clouds, fog, haze, weather light, and distant depth are baked into the plate.
- Generated candidates remain in `.tmp/today-atmosphere-backgrounds/`.
- Promotion is explicit and regenerates the static React Native registry.

## Workflow

```powershell
npm run art:today-backgrounds -- plan --scene-id clear_day
npm run art:today-backgrounds -- generate --scene-id clear_day --count 3
npm run art:today-backgrounds -- contact-sheet --scene-id clear_day
npm run art:today-backgrounds -- promote --scene-id clear_day --input .tmp/today-atmosphere-backgrounds/clear_day/candidate-2.png
```

Approve `clear_day` before generating variants. Every other scene uses the
approved clear plate as the authoritative composition/camera reference:

```powershell
npm run art:today-backgrounds -- generate --scene-id radiant_golden --count 3
npm run art:today-backgrounds -- revise --scene-id radiant_golden --input .tmp/today-atmosphere-backgrounds/radiant_golden/candidate-1.png --instruction "Soften the lower-right cloud bank."
```

Validate the complete promoted set with:

```powershell
npm run art:today-backgrounds:validate
```
