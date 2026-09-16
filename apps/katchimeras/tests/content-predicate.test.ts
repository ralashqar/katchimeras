import assert from 'node:assert/strict';
import test from 'node:test';

import { FERNIP_WILDGROWTH_CAMPAIGN } from '@/constants/island-campaigns/fernip-wildgrowth';
import { islandFallbackResolution, islandFallbackReturn, islandSpeech } from '@/constants/island-campaigns/helpers';
import { PETALIMP_BLOOM_CAMPAIGN } from '@/constants/island-campaigns/petalimp-bloom';
import { ISLAND_CAMPAIGNS } from '@/constants/island-campaigns/registry';
import { COMPANION_JOURNEY_CHAPTERS } from '@/constants/companion-journey-chapters/registry';
import { HATCHABLE_COMPANIONS } from '@/constants/hatchable-companions/registry';
import { MOSSPROUT_DAILY } from '@/constants/companion-daily/mossprout';
import { journeyLineFacts, renderJourneyLine } from '@/utils/companion-journey-personalisation';
import { evaluateCondition, fillTemplate, isContentData, renderContentText, resolveContentLine, resolvePredicate } from '@/utils/content-predicate';
import type { JourneyLineContext } from '@/types/companion-journey-chapter';
import type { IslandCampaignDefinition } from '@/constants/island-campaigns/types';

test('conditions read flat facts: equality, membership, order, presence, and their combinations', () => {
  const facts = { coins: 12, cost: 40, 'theory.friction': 'starting', today: null, 'answer.tiny.pace': 'rush', done: true };
  assert.equal(evaluateCondition({ fact: 'theory.friction', eq: 'starting' }, facts), true);
  assert.equal(evaluateCondition({ fact: 'theory.friction', eq: 'completion' }, facts), false);
  assert.equal(evaluateCondition({ fact: 'theory.friction', in: ['completion', 'starting'] }, facts), true);
  assert.equal(evaluateCondition({ fact: 'theory.friction', ne: 'starting' }, facts), false);
  assert.equal(evaluateCondition({ fact: 'coins', lt: 40 }, facts), true);
  assert.equal(evaluateCondition({ fact: 'coins', gte: 12 }, facts), true);
  assert.equal(evaluateCondition({ fact: 'cost', lte: 0 }, facts), false);
  assert.equal(evaluateCondition({ fact: 'theory.friction', gt: 0 }, facts), false, 'a word is not ordered');
  assert.equal(evaluateCondition({ fact: 'today', exists: true }, facts), false, 'null is absent');
  assert.equal(evaluateCondition({ fact: 'today', exists: false }, facts), true);
  assert.equal(evaluateCondition({ fact: 'nowhere', exists: true }, facts), false);
  assert.equal(evaluateCondition({ answer: 'tiny.pace', eq: 'rush' }, facts), true);
  assert.equal(evaluateCondition({ answer: 'tiny.pace', in: ['circle', 'list'] }, facts), false);
  assert.equal(evaluateCondition({ answer: 'petal.friend', exists: true }, facts), false);
  assert.equal(evaluateCondition({ all: [{ fact: 'done', eq: true }, { fact: 'coins', lt: 40 }] }, facts), true);
  assert.equal(evaluateCondition({ any: [{ fact: 'done', eq: false }, { fact: 'coins', lt: 40 }] }, facts), true);
  assert.equal(evaluateCondition({ not: { fact: 'done', eq: true } }, facts), false);
  // Code keeps working while bundled copy migrates; code that throws says no.
  assert.equal(resolvePredicate((context: { ok: boolean }) => context.ok, { ok: true }, () => facts), true);
  assert.equal(resolvePredicate(() => { throw new Error('no'); }, {}, () => facts), false);
  assert.equal(resolvePredicate({ fact: 'coins', eq: 12 }, {}, () => facts), true);
});

test('lines fill tokens from the facts: numbers grouped or raw, capped, made plural; unknown tokens render empty', () => {
  assert.equal(fillTemplate('{{steps}} more {{steps|plural:step,steps}}', { steps: 1 }), '1 more step');
  assert.equal(fillTemplate('{{steps}} more {{steps|plural:step,steps}}', { steps: 1234 }), '1,234 more steps');
  assert.equal(fillTemplate('{{steps|raw}}', { steps: 1234 }), '1234');
  assert.equal(fillTemplate('{{stepProgress|cap:500|raw}}/500', { stepProgress: 612 }), '500/500');
  assert.equal(fillTemplate('{{stepProgress|cap:500|raw}}/500', { stepProgress: 7 }), '7/500');
  assert.equal(fillTemplate('With {{friend}}: {{answer}} {{nothing}}.', { friend: 'Mossprout', answer: 'a walk' }), 'With Mossprout: a walk .');
  assert.equal(fillTemplate('{{flag}}', { flag: false }), '');
  assert.equal(renderContentText({ text: 'base', variants: [{ when: { fact: 'x', eq: 1 }, text: 'one' }, { when: { fact: 'x', eq: 2 }, text: 'two' }] }, { x: 2 }), 'two');
  assert.equal(renderContentText({ text: 'base {{x}}', variants: [{ when: { fact: 'x', eq: 1 }, text: 'one' }] }, { x: 3 }), 'base 3');
  assert.equal(resolveContentLine((n: number) => `code ${n}`, 4, () => ({})), 'code 4');
  assert.equal(resolveContentLine('data {{n}}', 4, () => ({ n: 4 })), 'data 4');
  assert.equal(isContentData('x'), true);
  assert.equal(isContentData(() => 'x'), false);
});

test('the island friends say what they said before, from data: every stage of cost and Glow, the return and the resolution', () => {
  const chapter = PETALIMP_BLOOM_CAMPAIGN.chapters[0]!;
  const speech = (campaign: { copy: IslandCampaignDefinition['copy'] }, status: 'available' | 'restoration_ready' | 'delivery_requested', coins: number, cost: number) =>
    islandSpeech(campaign.copy.speech![status]!, { chapter, choice: null, coins, cost });
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'available', 0, 0), 'I know just where to begin.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'available', 50, 40), 'I know just where to begin. Whenever you are ready.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'available', 12, 40), '12 of 40 Glow so far. The beds will keep until there is light enough.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'delivery_requested', 0, 0), 'This patch is spent. What we need next is on your board.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'restoration_ready', 0, 0), 'Everything is ready. This one is my gift.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'restoration_ready', 40, 40), 'We have what we need. Whenever you are ready.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'restoration_ready', 10, 40), '10 of 40 Glow so far. The garden is patient.');
  assert.equal(speech(PETALIMP_BLOOM_CAMPAIGN, 'restoration_ready', 30, 40), 'We are close now. A little more light and this part can grow.');
  assert.equal(speech(FERNIP_WILDGROWTH_CAMPAIGN, 'available', 1200, 2000), '1200 of 2000 Glow so far. The grove is in no rush.');
  assert.equal(speech(FERNIP_WILDGROWTH_CAMPAIGN, 'restoration_ready', 1200, 2000), 'Nearly there. The grove can wait a little longer.');
  assert.equal(speech(FERNIP_WILDGROWTH_CAMPAIGN, 'restoration_ready', 900, 2000), '900 of 2000 Glow so far. The grove is in no rush.');
  assert.equal(islandFallbackReturn(PETALIMP_BLOOM_CAMPAIGN, 'First Bloom'), 'Everything for First Bloom is here. Set it down and the Mist has to let go.');
  assert.equal(islandFallbackResolution(PETALIMP_BLOOM_CAMPAIGN, 4), 'Every bloom found room. The Mist has nothing left here to keep.');
  assert.equal(islandFallbackResolution(PETALIMP_BLOOM_CAMPAIGN, 2), 'The garden remembered a little more, because we came back and looked at it.');
  assert.equal(islandFallbackResolution(FERNIP_WILDGROWTH_CAMPAIGN, 4), 'The whole grove is ours again, and the Mist has nothing left to hold. Now it can rest, and so can I.');
  // Every campaign's copy is data now: a pack could carry it.
  for (const campaign of ISLAND_CAMPAIGNS) {
    assert.ok(isContentData(campaign.copy.fallbackReturn) && isContentData(campaign.copy.fallbackResolution), `${campaign.campaignId} speaks from data`);
    for (const line of Object.values(campaign.copy.speech ?? {})) assert.ok(isContentData(line), `${campaign.campaignId} voices its board from data`);
  }
});

test('journey lines pick their variant by data and fill their tokens from the same facts', () => {
  const context: JourneyLineContext = {
    friendName: 'Mossprout',
    theory: { style: 'gentle', friction: 'completion', reward: 'calm', evidence: 0, observations: [] } as unknown as JourneyLineContext['theory'],
    facts: { pace: 'slowly' }, answers: { 'old-garden.grove.back': 'grove.back:with' }, today: 'weather.sun',
  };
  const facts = journeyLineFacts(context);
  assert.deepEqual(facts, { friend: 'Mossprout', today: 'weather.sun', 'theory.style': 'gentle', 'theory.friction': 'completion', 'theory.reward': 'calm', 'fact.pace': 'slowly', 'answer.old-garden.grove.back': 'grove.back:with' });
  assert.equal(renderJourneyLine('{{friend}} said {{fact.pace}} on {{today}} ({{theory.friction}}) {{answer.old-garden.grove.back}} {{nothing}}', context), 'Mossprout said slowly on weather.sun (completion) grove.back:with ');
  // Every variant across every chapter is data, and every condition reads a fact the context provides.
  const known = new Set(Object.keys(facts));
  for (const chapter of COMPANION_JOURNEY_CHAPTERS) {
    for (const episode of chapter.episodes) {
      for (const beat of episode.beats ?? []) {
        if (!('variants' in beat) || !beat.variants) continue;
        for (const variant of beat.variants) {
          assert.ok(isContentData(variant.when), `${chapter.chapterId}/${episode.id}: a variant condition is data`);
          const condition = variant.when as { fact?: string; answer?: string };
          if (condition.fact) assert.ok(known.has(condition.fact), `${episode.id} reads ${condition.fact}`);
          if (condition.answer) assert.match(condition.answer, /^[\w-]+\.[\w.-]+$/, `${episode.id} reads an answer by episode and ask`);
        }
      }
    }
    if (chapter.lines.lifeRequestSubtitle) assert.ok(isContentData(chapter.lines.lifeRequestSubtitle));
  }
  // The daily configs: the memory label and the step ladder's lines are data too.
  assert.equal(resolveContentLine(MOSSPROUT_DAILY.photo!.keepPhoto!.memoryLabel, 'a walk', () => ({ answer: 'a walk' })), 'With Mossprout: a walk');
  for (const definition of HATCHABLE_COMPANIONS) {
    const goal = definition.daily?.goal;
    if (!goal) continue;
    assert.ok(isContentData(goal.lines.remaining) && isContentData(goal.lines.claimed), `${definition.companion}'s step lines are data`);
    assert.match(resolveContentLine(goal.lines.remaining, 1, () => ({ steps: 1 })), /1 more step to/);
    assert.match(resolveContentLine(goal.lines.claimed, 2500, () => ({ steps: 2500 })), /^2,500 steps!/);
  }
});
