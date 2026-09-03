# Guided camera input

Legacy FTUE steps support `lockCamera: true | false` on `FtueStepDefinition`.
Guided steps default to locked, including hosted companion steps; `complete`
releases the lock. Use `lockCamera: false` only for an intentional exploration beat.

Content-flow `worldActionScene` accepts `view.lockCamera` and defaults it to true.
The Glow chapter holds camera input across its presentation/effect boundaries and
recoverable failures as well, releasing it when the run completes. A scene can
explicitly opt out with `view.lockCamera: false`.

Locks disable player pan/pinch, Recenter and tap-to-focus, but do not stop authored
camera transitions or required CTA buttons. They follow the durable step/run, not
spotlight visibility or animation duration. Advancing to another locked step keeps
the camera locked; pressing a CTA does not itself release it before advancement.
