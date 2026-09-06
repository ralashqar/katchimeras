// Essence — the cosmetic currency. Earned is DERIVED from history (re-computed each
// evaluation, never a mutable counter → ungrindable + reinstall-safe); only SPENT
// is persisted. balance = earned − spent. Cosmetic-only, never affects progression.
// See docs/progression-customisation-design.md §3.

export type EssenceState = {
  version: 1;
  spent: number; // total essence spent on cosmetics (only ever increases)
  purchases: string[]; // cosmeticIds bought with essence (the receipt)
};
