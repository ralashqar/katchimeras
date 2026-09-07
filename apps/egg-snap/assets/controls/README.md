# Egg Snap combat controls

Pause and settings buttons were generated with built-in imagegen. Original artwork and exact prompts are in `sources/`.

Run `python apps/egg-snap/scripts/package-controls.py` from the repository root to normalize their alpha and export 144px runtime PNGs. Buttons display at 48pt with 48pt touch targets. They are standalone art with no horizontal background strip.

Pause opens the pause menu. Settings opens the same suspended-duel controls with a settings title; sound, haptics, readability and resume retain their existing behavior.
