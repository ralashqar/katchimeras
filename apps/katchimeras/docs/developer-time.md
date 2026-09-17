# Developer time

Developer Tools → Time displays actual device time, effective game time and the offset. Skip 1 hour, Skip 4 hours and Skip 1 day add to the offset. No restart is needed; the offset survives app restarts. Reset to actual time clears the saved and running offset. Full storage, progression and onboarding profile resets also clear it.

The client gameplay clock (`utils/game-clock.ts`) is used by chapter/rest gates, story flow timestamps, local events, Merge commands and the Merge repository. Animation timers, native sensor queries and authoritative server replay clocks retain actual time. Production builds without the developer-tools flag ignore offsets. New client gameplay timer entry points should call `gameNow()` and pure reducers should continue accepting explicit `now` values.

Test a four-hour chapter wait by opening its timer, adding four hours in Developer Tools and returning to the companion. Other requirements (orders, Bond, restoration) still apply. For local events, activate a dated pack, skip across its start/end boundaries and inspect the world action or event overview.

Reset time is not a save rollback. Earned progress, timestamped actions, claimed rewards and event expiry checkpoints remain. Existing event clock rollback protection may keep an already-expired event expired after resetting time. Use a fresh profile or a new event occurrence to replay that scenario from scratch. Server-authoritative events cannot be advanced with this local control.
