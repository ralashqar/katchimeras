import type { MergeWorldState } from '@/types/merge-world';

/** The finale's ids (Chapter 10): its battle's ledger key, and the Hollow Tree's structure (`features/finale/hollow-tree.ts`). */
export const HOLLOW_TREE_FINALE_ID = 'finale:hollow-tree';
export const HOLLOW_TREE_STRUCTURE_ID = 'hollow-tree';

/** The Hollow Tree woken: its finale won. */
export const hollowTreeRestored = (world: Pick<MergeWorldState, 'encounters'>) => Boolean(world.encounters?.clears?.[HOLLOW_TREE_FINALE_ID]);
