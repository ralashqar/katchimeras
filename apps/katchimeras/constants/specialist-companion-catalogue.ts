import { BATCH_SEVEN_SPECIALIST_SYSTEMS } from '@/constants/batch-seven-specialist-system';
import { BATCH_EIGHT_SPECIALIST_SYSTEMS } from '@/constants/batch-eight-specialist-system';
import { BATCH_NINE_SPECIALIST_SYSTEMS } from '@/constants/batch-nine-specialist-system';
import { BATCH_TEN_SPECIALIST_SYSTEMS } from '@/constants/batch-ten-specialist-system';
import { SPECIALIST_JOURNEY_ID_BY_FAMILY_ID } from '@/constants/katchimera-bespoke-quests';

export const SPECIALIST_COMPANION_SYSTEMS = [
  ...BATCH_SEVEN_SPECIALIST_SYSTEMS,
  ...BATCH_EIGHT_SPECIALIST_SYSTEMS,
  ...BATCH_NINE_SPECIALIST_SYSTEMS,
  ...BATCH_TEN_SPECIALIST_SYSTEMS,
];

export const SPECIALIST_COMPANION_CONTENT = Object.fromEntries(
  SPECIALIST_COMPANION_SYSTEMS.map((system) => [system.familyId, system.content])
);

export const specialistJourneyIdByFamilyId = SPECIALIST_JOURNEY_ID_BY_FAMILY_ID;
