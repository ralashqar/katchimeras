# Conversation overlay QA

The overlay is enabled for every companion conversation. Pre-hatch mood/support questions keep their existing presentation. Upgrade stories share bubble styling but retain their own progression and FTUE exclusions.

## Device checkpoints

Use a development profile and the existing reset/progression tools. Test both a narrow phone and a large phone, then repeat with large text and Reduce Motion.

1. **Fresh FTUE:** hatch, meet Mossprout, choose an answer, see the reply and next prompt appear together without an intermediate Continue. Confirm the top bar and coachmarks stay behind the modal. Back cannot skip the conversation. The pre-hatch mood question should be unchanged.
2. **First Bond action:** answer growth/support prompts. Force-close after selecting support, before Continue. Reopen: the selected answer and Mossprout reply remain visible, with no reward yet. Continue: the overlay fades, the completed action card appears, and its existing Bond reward arrives once.
3. **Branching action card:** open a conversation from a companion action card. Verify the selected answer uses the Egg avatar and exact option wording; the next question does not replace earlier bubbles. Close with X halfway through, reopen, and finish. Check the reward comes from the launching card.
4. **Result and handoff:** exercise a form finder, insight with save/decline, memory, goal, journal and quest. Each result requires an explicit action. External destinations remain reachable. Return from a handoff without replaying prior rewards.
5. **Interrupted completion:** quit before final Continue, during exit, and while the card reward travels. Reopen and verify the saved checkpoint and existing receipt prevent duplicate awards.
6. **Upgrade regression:** Garden restoration and Steppling clearing use FTUE narrative only. Later upgrades retain required upgrade narrative, history button, alternating speakers and Glow costs.
7. **Accessibility:** scroll up in history while a message appears (stay at reading position), use Latest, inspect VoiceOver/TalkBack focus, and check that dialogue, results, and long options share one scroll area with the final Continue.

For a development-only last-message comparison, start Expo with `EXPO_PUBLIC_CONVERSATION_LAYOUT=compact`. Remove the variable for full history. This changes presentation only; both modes use the same conversation sessions and receipts. Production always uses full history.

## Automated checks

Run `npm run typecheck --workspace=katchimeras` from the repository root and `npm run verify:story-flows --workspace=katchimeras`.

The story suite includes transcript snapshots/legacy recovery, manual completion, modal close restrictions, duplicate taps, save failure retry, animation-before-callback ordering, FTUE Bond relaunch and existing upgrade narrative tests. Automated native mocks do not verify actual device drawing, font rasterization or screen-reader focus; complete the device checklist before release.
