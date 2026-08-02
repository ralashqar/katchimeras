import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discoveryPromptsForFamily,
  katchimeraRoleCoverage,
  katchimeraRoles,
  validateKatchimeraRoleCatalogue,
} from '@/constants/katchimera-roles';
import { BESPOKE_FAMILY_QUEST_PACKS } from '@/constants/katchimera-bespoke-quests';
import { katchimeraFamilyById } from '@/constants/katchimera-skins';
import { validateCompleteCompanionContent } from '@/constants/companion-content';
import type { StoredHomeState } from '@/types/home';
import {
  COMPANION_BOND_REWARDS,
  backfillHatchBondEvents,
  companionBondProgress,
  emptyCompanionBondState,
  questBondEventKind,
  recordCompanionBondEvent,
} from '@/utils/companion-bond';
import {
  answerCompanionDiscoveryPrompt,
  emptyCompanionDiscoveryState,
  removeCompanionDiscoveryAnswer,
  setCompanionGoalStatus,
} from '@/utils/companion-discovery';
import { questDefinition } from '@/utils/quests/definitions';
import { themedQuestOffers } from '@/utils/quests/themed';

test('every family has a role and authored families are complete', () => {
  assert.deepEqual(validateKatchimeraRoleCatalogue(), []);
  assert.deepEqual(validateCompleteCompanionContent(), []);
  const coverage = katchimeraRoleCoverage();
  assert.equal(coverage.total, 60);
  assert.equal(coverage.playable, 56);
  assert.equal(coverage.complete, 18);
  assert.equal(coverage.partial, 36);
  assert.equal(coverage.fallback, 0);
  assert.equal(coverage.planned, 6);
  assert.deepEqual(
    katchimeraRoles.filter((role) => role.status === 'complete').map((role) => role.familyId).sort(),
    [
      'cheerlet',
      'coffee-ritual',
      'dawnle',
      'encora',
      'errandimp',
      'feastle',
      'flickerbun',
      'gatherglow',
      'mendle',
      'mossprout',
      'pagelet',
      'quietome',
      'relicoon',
      'skylo',
      'sleep-rest',
      'steppling',
      'tasklet',
      'vesperitt',
    ]
  );
});

test('every formerly fallback family owns a progressive bespoke quest ladder', () => {
  assert.equal(BESPOKE_FAMILY_QUEST_PACKS.length, 29);
  for (const pack of BESPOKE_FAMILY_QUEST_PACKS) {
    const family = katchimeraFamilyById.get(pack.familyId);
    const role = katchimeraRoles.find((candidate) => candidate.familyId === pack.familyId);
    assert.ok(family?.anchorVisualKey, `${pack.familyId} must have playable art`);
    assert.equal(role?.status, 'partial', `${pack.familyId} must no longer use fallback content`);
    assert.equal(role?.realLifeQuestIds.length, 4, `${pack.familyId} needs a four-quest ladder`);

    const levels = role?.realLifeQuestIds.map((questId) => {
      const definition = questDefinition(questId);
      assert.ok(definition, `${pack.familyId} is missing ${questId}`);
      assert.equal(definition?.familyId, pack.familyId, `${questId} must remain family-owned`);
      assert.equal(definition?.lane, 'real_life');
      if (definition?.family === 'photo') {
        assert.equal(definition.evidenceInput?.kind, 'photo');
        assert.ok(definition.requiresCapabilities?.includes('camera.capture'));
        assert.ok(definition.optionalCapabilities?.includes('appleVision'));
      } else {
        assert.equal(definition?.evidenceInput?.kind, 'journal');
        assert.deepEqual(definition?.semanticVerification?.modalities, ['text', 'voice']);
        assert.ok(definition?.semanticVerification?.journalRouteFallbacks?.length, `${questId} needs a manual route`);
        assert.equal(definition?.requiresCapabilities?.length, 0, `${questId} must work without Foundation`);
        assert.ok(definition?.optionalCapabilities?.includes('appleFoundation'));
      }
      return definition?.minimumBondLevel;
    });
    assert.deepEqual(levels, [1, 1, 2, 3], `${pack.familyId} needs progressive bond levels`);

    const offers = themedQuestOffers('', '', family!.anchorVisualKey!);
    assert.deepEqual(
      offers.map((offer) => offer.id),
      role?.realLifeQuestIds,
      `${pack.familyId} must offer only its family-owned pool`
    );
    assert.equal(offers.some((offer) => offer.id === 'quest-snap-today'), false);
  }
});

test('every completed role references valid lane-specific quests', () => {
  for (const role of katchimeraRoles.filter((item) => item.status === 'complete')) {
    for (const questId of role.realLifeQuestIds) {
      const definition = questDefinition(questId);
      assert.ok(definition, `${role.familyId} is missing ${questId}`);
      assert.equal(definition?.lane, 'real_life', `${questId} must be a real-life quest`);
    }
    for (const questId of role.miniGameQuestIds) {
      const definition = questDefinition(questId);
      assert.ok(definition, `${role.familyId} is missing ${questId}`);
      assert.equal(definition?.lane, 'mini_game', `${questId} must be a mini-game`);
    }
  }
});

test('bond tiers progressively unlock discovery prompts', () => {
  assert.equal(discoveryPromptsForFamily('steppling', 1).length, 1);
  assert.equal(discoveryPromptsForFamily('steppling', 2).length, 2);
});

test('Vesperitt owns late-night life without overlapping the rest family', () => {
  const role = katchimeraRoles.find((item) => item.familyId === 'vesperitt');
  assert.equal(role?.status, 'complete');
  assert.match(role?.boundary ?? '', /not sleep/i);
  assert.equal(discoveryPromptsForFamily('vesperitt', 1).length, 1);
  assert.equal(discoveryPromptsForFamily('vesperitt', 2).length, 2);
  assert.equal(discoveryPromptsForFamily('vesperitt', 3).length, 3);

  const offers = themedQuestOffers('small_hours', 'night', 'vesperitt');
  assert.ok(offers.some((offer) => offer.id === 'quest-late-capture' && offer.lane === 'real_life'));
  assert.ok(offers.some((offer) => offer.id === 'quest-vesperitt-night-note' && offer.minimumBondLevel === 2));
  assert.ok(offers.some((offer) => offer.id === 'quest-vesperitt-moon-signals' && offer.lane === 'mini_game'));
  assert.equal(offers.some((offer) => offer.id === 'quest-early-night'), false);
});

test('discovery answers are editable, removable, and rewarded only on first answer', () => {
  const prompt = discoveryPromptsForFamily('steppling', 1)[0]!;
  const first = answerCompanionDiscoveryPrompt(emptyCompanionDiscoveryState(), prompt, 'Exploring', 10);
  const edit = answerCompanionDiscoveryPrompt(first.state, prompt, 'Clearing my head', 20);
  assert.equal(first.firstAnswer, true);
  assert.equal(edit.firstAnswer, false);
  assert.equal(edit.state.answers[0]?.value, 'Clearing my head');
  assert.equal(removeCompanionDiscoveryAnswer(edit.state, 'steppling', prompt.id).answers.length, 0);
});

test('goal answers retain editable progress state', () => {
  const prompt = discoveryPromptsForFamily('steppling', 2).find((item) => item.kind === 'goal')!;
  const answered = answerCompanionDiscoveryPrompt(emptyCompanionDiscoveryState(), prompt, 'Walk at lunch', 10);
  const completed = setCompanionGoalStatus(answered.state, 'steppling', prompt.id, 'completed', 20);
  assert.equal(completed.answers[0]?.goalStatus, 'completed');
});

test('skin variants receive the same family mini-game', () => {
  const bedrotte = themedQuestOffers('good_sleep', 'night', 'bedrotte');
  const snoozle = themedQuestOffers('good_sleep', 'night', 'snoozle');
  assert.equal(bedrotte.some((offer) => offer.id === 'quest-bedrotte-breathe'), true);
  assert.equal(snoozle.some((offer) => offer.id === 'quest-bedrotte-breathe'), true);
});

test('historical hatches backfill into one family-level bond ledger', () => {
  const creature = (id: string, visualKey: 'bedrotte' | 'snoozle', profile: string) => ({
    id,
    name: visualKey,
    visualKey,
    encounterProfileId: profile,
    aspectId: 'rest-sleep',
    familyId: 'sleep-rest',
    skinId: visualKey,
    companionId: 'companion:sleep-rest',
  });
  const day = (id: string, isoDate: string, resident: ReturnType<typeof creature>) => ({
    id,
    isoDate,
    creature: resident,
  });
  const home = {
    archivedDays: [
      day('day-1', '2026-07-20', creature('bed', 'bedrotte', 'location_home_evening_bedrotte')),
      day('day-2', '2026-07-21', creature('snooze', 'snoozle', 'state_well_rested_snoozle')),
    ],
    today: day('day-3', '2026-07-22', creature('bed-2', 'bedrotte', 'location_home_evening_bedrotte')),
    tomorrow: null,
  } as unknown as StoredHomeState;

  const first = backfillHatchBondEvents(emptyCompanionBondState(), home);
  const repeated = backfillHatchBondEvents(first, home);
  assert.equal(first.events.length, 3);
  assert.equal(repeated.events.length, 3);
  assert.equal(companionBondProgress(first, 'companion:sleep-rest').totalPoints, 30);
});

test('quest lanes use distinct rewards and mini-game daily ids deduplicate', () => {
  const realLife = questDefinition('quest-long-walk');
  const miniGame = questDefinition('quest-steppling-stride');
  assert.equal(questBondEventKind(realLife), 'real_life_quest_completed');
  assert.equal(questBondEventKind(miniGame), 'mini_game_completed');
  assert.equal(COMPANION_BOND_REWARDS.real_life_quest_completed, 25);
  assert.equal(COMPANION_BOND_REWARDS.mini_game_completed, 10);

  const first = recordCompanionBondEvent(emptyCompanionBondState(), {
    id: 'mini-game:companion:steppling:2026-07-25',
    creatureId: 'companion:steppling',
    kind: 'mini_game_completed',
    occurredAt: 1,
    dayId: '2026-07-25',
  });
  const duplicate = recordCompanionBondEvent(first.state, {
    id: 'mini-game:companion:steppling:2026-07-25',
    creatureId: 'companion:steppling',
    kind: 'mini_game_completed',
    occurredAt: 2,
    dayId: '2026-07-25',
  });
  assert.equal(first.awarded, true);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.state.events.length, 1);
});
