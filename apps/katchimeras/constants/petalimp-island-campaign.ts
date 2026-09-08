import type {
  ConversationDefinition,
  ConversationInsightResultDefinition,
  ConversationOption,
} from '@/types/companion-conversation';
import type { MergeOrder, MergeWorldState, MossproutNatureIslandLevel } from '@/types/merge-world';

export const PETALIMP_ISLAND_CAMPAIGN_ID = 'island-campaign:petalimp-bloom';
export const PETALIMP_ISLAND_ID = 'bloom-garden' as const;

export type PetalimpGrowthStyle = 'gentle' | 'curious' | 'together';

type ChapterOrder = Pick<MergeOrder, 'title' | 'description' | 'difficulty' | 'requirements' | 'narrativeSignal'>;

export type PetalimpIslandChoice = {
  id: string;
  label: string;
  reply: string;
  growthStyle: PetalimpGrowthStyle;
  wispAffinity: NonNullable<ConversationOption['wispAffinity']>;
  order: ChapterOrder;
  openingConclusion: string;
  returnLine: string;
  resolutionLine: string;
};

type Chapter = {
  level: Exclude<MossproutNatureIslandLevel, 0>;
  title: string;
  prompt: string;
  conversationId: string;
  returnConversationId: string;
  resolutionConversationId: string;
  fallbackOrder: ChapterOrder;
  choices: readonly PetalimpIslandChoice[];
};

const order = (
  title: string,
  description: string,
  difficulty: MergeOrder['difficulty'],
  narrativeSignal: ChapterOrder['narrativeSignal'],
  requirements: MergeOrder['requirements'],
): ChapterOrder => ({ title, description, difficulty, narrativeSignal, requirements });

export const PETALIMP_ISLAND_CHAPTERS: readonly Chapter[] = [
  {
    level: 1,
    title: 'One Small Beginning',
    conversationId: 'mossprout:island:petalimp:first-welcome',
    returnConversationId: 'mossprout:island:petalimp:first-welcome:return',
    resolutionConversationId: 'mossprout:island:petalimp:first-welcome:restored',
    prompt: 'This used to be a Welcome Garden. Now it is so bare that I keep thinking our first flower has to be perfect.\n\nWhen something feels empty, what helps you begin?',
    fallbackOrder: order('The First Bloom', 'Make one Flower for the garden’s first small beginning.', 'small', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
    choices: [
      {
        id: 'begin-small', label: 'The smallest possible step', reply: 'One flower, then. Small enough to begin. Big enough to matter.',
        growthStyle: 'gentle', wispAffinity: { sprout: 2 },
        order: order('One Brave Bloom', 'Make one Flower so the empty garden has somewhere gentle to begin.', 'small', 'ease', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
        openingConclusion: 'I can do one flower without asking it to carry the whole garden. Let’s make it together in Merge.',
        returnLine: 'You brought exactly enough for a beginning. The soil is ready—and the first restoration is my gift.',
        resolutionLine: 'Look at its little face reaching up. The garden is still quiet, but it is not waiting alone anymore.',
      },
      {
        id: 'begin-playful', label: 'Trying something playful', reply: 'An experiment! If it grows sideways, we shall call that personality.',
        growthStyle: 'curious', wispAffinity: { giggle: 2 },
        order: order('A Curious Flower', 'Make one Flower for Petalimp’s first cheerful garden experiment.', 'small', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
        openingConclusion: 'No perfect plan, then. Just one curious bloom and permission to see what happens.',
        returnLine: 'Our experiment is ready. I promised the flower it would not be graded. Let’s wake the soil.',
        resolutionLine: 'It grew exactly where it wanted. That feels like the garden remembering how to surprise us.',
      },
      {
        id: 'begin-together', label: 'Having someone beside me', reply: 'Then neither of us has to be brave enough for the whole patch alone.',
        growthStyle: 'together', wispAffinity: { heartlet: 2 },
        order: order('Our First Flower', 'Make one Flower for the place you and Petalimp are beginning together.', 'small', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }]),
        openingConclusion: 'You bring the flower. I’ll fuss over the soil. That sounds like a beginning we can share.',
        returnLine: 'You came back. I think that matters as much as the flower. Everything is ready now.',
        resolutionLine: 'There it is—our first flower. I thought I needed a garden before I could belong here. Perhaps I only needed company.',
      },
    ],
  },
  {
    level: 2,
    title: 'Colours That Belong',
    conversationId: 'mossprout:island:petalimp:colours-belong',
    returnConversationId: 'mossprout:island:petalimp:colours-belong:return',
    resolutionConversationId: 'mossprout:island:petalimp:colours-belong:restored',
    prompt: 'The first flower stayed. I have been arranging the next beds in perfectly matching rows, because proper gardens look as though they know the rules.\n\nWhat makes a place begin to feel like yours?',
    fallbackOrder: order('Colours That Belong', 'Bring a Flower and a Sprout for the garden’s new colour beds.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
    choices: [
      {
        id: 'belong-familiar', label: 'Something familiar', reply: 'One familiar thing can make a strange place stop feeling quite so far away.',
        growthStyle: 'gentle', wispAffinity: { breeze: 2 },
        order: order('A Familiar Corner', 'Bring a Flower and a Sprout to make one colour bed feel known and comforting.', 'medium', 'comfort', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
        openingConclusion: 'Let’s give the garden one familiar corner before we ask it to become anything grand.',
        returnLine: 'I know where these belong. For the first time, I know where I might belong too. The colour beds are ready for 60 Glow.',
        resolutionLine: 'This corner feels familiar already. A home does not have to be old to give you somewhere soft to land.',
      },
      {
        id: 'belong-change', label: 'Room to change things', reply: 'No matching forever? Wonderful. The flowers may rearrange themselves whenever they please.',
        growthStyle: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
        order: order('Colours Without Rules', 'Bring a Flower and a Sprout for a colour bed with room to change.', 'medium', 'curiosity', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
        openingConclusion: 'We will make beds, not boundaries. Let’s find colours that are allowed to change their minds.',
        returnLine: 'Nothing matches, and somehow all of it belongs. The new beds can take root when we bring 60 Glow.',
        resolutionLine: 'Every colour found room without following my plan. The garden feels more like me because it was allowed to change.',
      },
      {
        id: 'belong-shared', label: 'Someone to share it with', reply: 'Then a place becomes ours through the welcome, not through the decorating.',
        growthStyle: 'together', wispAffinity: { heartlet: 2 },
        order: order('A Bed to Share', 'Bring a Flower and a Sprout for a colour bed that welcomes company.', 'medium', 'connection', [{ definitionId: 'nature:garden:4', quantity: 1 }, { definitionId: 'nature:garden:2', quantity: 1 }]),
        openingConclusion: 'Let’s build a corner that looks as though it was hoping someone would visit.',
        returnLine: 'These are ready to plant side by side. With 60 Glow, the garden can make room for both.',
        resolutionLine: 'The colours look brighter together. I think welcome might be something a place learns by practising.',
      },
    ],
  },
  {
    level: 3,
    title: 'A Path at Your Pace',
    conversationId: 'mossprout:island:petalimp:wandering-walk',
    returnConversationId: 'mossprout:island:petalimp:wandering-walk:return',
    resolutionConversationId: 'mossprout:island:petalimp:wandering-walk:restored',
    prompt: 'The beds are growing, and I keep racing between them in case the garden notices I have stopped. Perhaps a path should help us enjoy where we are.\n\nWhen life feels full, what helps you keep moving?',
    fallbackOrder: order('The Wandering Walk', 'Make a Rare Flower and a Shell for the garden path.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
    choices: [
      {
        id: 'pace-next-step', label: 'One clear next step', reply: 'One stone, then the next. A path does not need to show us its whole ending.',
        growthStyle: 'gentle', wispAffinity: { sprout: 2 },
        order: order('The Next Stepping Stone', 'Make a Rare Flower and a Shell to mark one clear turn in the path.', 'medium', 'ease', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
        openingConclusion: 'We will build the walk one visible turn at a time. Merge can help us mark the first.',
        returnLine: 'One clear turn is ready. We do not need to solve the whole path today; 150 Glow will open this part.',
        resolutionLine: 'The path only shows us the next bend. Strangely, that makes the whole garden feel easier to cross.',
      },
      {
        id: 'pace-pause', label: 'Permission to pause', reply: 'Then the best part of the path should be somewhere it is perfectly acceptable to stop.',
        growthStyle: 'curious', wispAffinity: { breeze: 2 },
        order: order('A Place Along the Way', 'Make a Rare Flower and a Shell for a restful turn in the garden path.', 'medium', 'comfort', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
        openingConclusion: 'A pause can belong inside the journey. Let’s make one worth arriving at.',
        returnLine: 'Our resting turn is ready. It can become part of the walk when the garden has 150 Glow.',
        resolutionLine: 'Even the butterflies stop here. The garden kept growing while we paused long enough to notice.',
      },
      {
        id: 'pace-together', label: 'Doing it together', reply: 'A path wide enough for two. And several butterflies who refuse to walk in a line.',
        growthStyle: 'together', wispAffinity: { heartlet: 2 },
        order: order('The Side-by-Side Walk', 'Make a Rare Flower and a Shell for a path meant to be shared.', 'medium', 'connection', [{ definitionId: 'nature:garden:5', quantity: 1 }, { definitionId: 'nature:waterside:2', quantity: 1 }]),
        openingConclusion: 'Then this path will never make anyone walk the hard part alone. Let’s shape its first turn.',
        returnLine: 'Everything is ready for a path with room for company. It will take 150 Glow to open it.',
        resolutionLine: 'There is room for both of us here. Somehow the distance feels smaller when a path expects company.',
      },
    ],
  },
  {
    level: 4,
    title: 'Room for Every Bloom',
    conversationId: 'mossprout:island:petalimp:every-bloom',
    returnConversationId: 'mossprout:island:petalimp:every-bloom:return',
    resolutionConversationId: 'mossprout:island:petalimp:every-bloom:restored',
    prompt: 'Some flowers have appeared far outside their beds. I nearly moved them back—then I wondered whether the garden was showing us a better ending.\n\nWhat would you want to remember when things grow differently than planned?',
    fallbackOrder: order('The Garden Remembers', 'Make a Memory Bloom and a Magical Plant for the garden’s final welcome.', 'major', 'comfort', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
    choices: [
      {
        id: 'change-progress', label: 'Small progress still counts', reply: 'Even the wonky little bloom crossed a great deal of soil to reach us.',
        growthStyle: 'gentle', wispAffinity: { sprout: 2, heartlet: 1 },
        order: order('Every Little Bloom', 'Make a Memory Bloom and a Magical Plant to celebrate every piece of progress.', 'major', 'ease', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
        openingConclusion: 'We will finish by honouring every small thing that made it this far.',
        returnLine: 'Every small piece is here. With 300 Glow, we can let the whole garden remember how far it has come.',
        resolutionLine: 'The garden did not become beautiful all at once. It became beautiful each time we returned and helped one more thing grow.',
      },
      {
        id: 'change-flexible', label: 'Plans can change', reply: 'Good. I am officially revising my plan to include flowers with their own opinions.',
        growthStyle: 'curious', wispAffinity: { giggle: 2, bloom: 1 },
        order: order('The Beautiful Detour', 'Make a Memory Bloom and a Magical Plant for the garden’s unexpected ending.', 'major', 'curiosity', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
        openingConclusion: 'Let’s give the garden what it needs to become itself instead of my tidy first draft.',
        returnLine: 'The changed plan is ready—and much better dressed. The final bloom needs 300 Glow.',
        resolutionLine: 'It is nothing like my first plan. It is warmer, stranger, and alive. I am glad we listened when it changed.',
      },
      {
        id: 'change-help', label: 'We can ask for help', reply: 'Then the garden never has to prove it can grow alone. Neither do we.',
        growthStyle: 'together', wispAffinity: { heartlet: 2, bloom: 1 },
        order: order('A Garden We Share', 'Make a Memory Bloom and a Magical Plant for a welcome built together.', 'major', 'connection', [{ definitionId: 'hybrid:memory-bloom', quantity: 1 }, { definitionId: 'nature:garden:6', quantity: 1 }]),
        openingConclusion: 'One last shared task, then. We will finish the way we began: together.',
        returnLine: 'We have everything except 300 Glow—and I know now that asking for the last bit of help is part of growing.',
        resolutionLine: 'Every bloom found room because this was never one creature’s garden. We made a welcome that can keep growing with us.',
      },
    ],
  },
] as const;

export const petalimpIslandChapter = (level: MossproutNatureIslandLevel) => (
  PETALIMP_ISLAND_CHAPTERS.find((chapter) => chapter.level === level) ?? null
);

export const petalimpIslandChapterChoice = (level: MossproutNatureIslandLevel, choiceId?: string | null) => (
  petalimpIslandChapter(level)?.choices.find((choice) => choice.id === choiceId) ?? null
);

export function petalimpIslandChapterOrder(level: MossproutNatureIslandLevel, choiceIdOrNow?: string | number | null, nowArg?: number): MergeOrder | null {
  const chapter = petalimpIslandChapter(level);
  if (!chapter) return null;
  const choiceId = typeof choiceIdOrNow === 'string' ? choiceIdOrNow : null;
  const now = typeof choiceIdOrNow === 'number' ? choiceIdOrNow : nowArg ?? Date.now();
  const selected = petalimpIslandChapterChoice(level, choiceId);
  const selectedOrder = selected?.order ?? chapter.fallbackOrder;
  return {
    id: `${PETALIMP_ISLAND_CAMPAIGN_ID}:level-${level}:order${selected ? `:${selected.id}` : ''}`,
    characterId: 'mossprout', recipientSkinId: 'petalimp',
    title: selectedOrder.title, description: selectedOrder.description,
    narrativeSignal: selectedOrder.narrativeSignal, difficulty: selectedOrder.difficulty,
    requirements: selectedOrder.requirements.map((requirement) => ({ ...requirement })),
    reward: { coins: 18 + level * 4, mergeXp: 16 + level * 6, friendshipXp: 8, energy: 0 },
    createdAt: now, signature: level === 4, purpose: level === 4 ? 'signature' : 'normal',
    chapterId: `petalimp-bloom-level-${level}`, storyArcId: PETALIMP_ISLAND_CAMPAIGN_ID,
    storyBeatId: `${PETALIMP_ISLAND_CAMPAIGN_ID}:level-${level}`, storyTargetLevel: level,
    storyStep: 1, storyStepCount: 1,
  };
}

export type PetalimpIslandChapterStatus = 'available' | 'orders_active' | 'return_ready' | 'restoration_ready' | 'resolution_ready' | 'complete';

export type PetalimpIslandUpgradePanelState = {
  action: 'start_story' | 'open_merge' | 'continue_return' | 'continue_resolution' | null;
  level: MossproutNatureIslandLevel;
  order: MergeOrder | null;
  orderComplete: boolean;
  stateLabel: string;
  status: PetalimpIslandChapterStatus;
};

export function petalimpIslandChapterStatus(world: MergeWorldState, level: MossproutNatureIslandLevel): PetalimpIslandChapterStatus {
  const progress = world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID]?.chapters[String(level)];
  if (!progress) return 'available';
  if (progress.completedAt != null) return 'complete';
  if (!progress.orderIds.every((id) => progress.servedOrderIds.includes(id))) return 'orders_active';
  if (progress.returnConversationSeenAt == null) return 'return_ready';
  return (world.haven.mossproutNatureIslands[PETALIMP_ISLAND_ID] ?? 0) >= level ? 'resolution_ready' : 'restoration_ready';
}

/** One durable view model owns what the Bloom Garden upgrade panel shows and where its explicit action leads. */
export function petalimpIslandUpgradePanelState(world: MergeWorldState): PetalimpIslandUpgradePanelState | null {
  const campaign = world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID];
  if (!campaign?.discoveryRevealSeenAt) return null;
  const chapter = PETALIMP_ISLAND_CHAPTERS.find((candidate) => petalimpIslandChapterStatus(world, candidate.level) !== 'complete');
  if (!chapter) return null;
  const progress = campaign.chapters[String(chapter.level)];
  const status = petalimpIslandChapterStatus(world, chapter.level);
  const orderId = progress?.orderIds[0];
  const savedOrder = orderId ? world.activeOrders.find((candidate) => candidate.id === orderId) : null;
  const authoredOrder = progress ? petalimpIslandChapterOrder(chapter.level, progress.selectedOptionId) : null;
  const order = savedOrder ?? (authoredOrder && orderId ? { ...authoredOrder, id: orderId } : null);
  const orderComplete = Boolean(orderId && progress?.servedOrderIds.includes(orderId));
  const presentation = {
    available: { action: 'start_story' as const, stateLabel: 'Choose how this part of the garden should grow.' },
    orders_active: { action: 'open_merge' as const, stateLabel: 'Requested in Merge' },
    return_ready: { action: 'continue_return' as const, stateLabel: 'Request complete' },
    restoration_ready: { action: null, stateLabel: 'Request complete · Ready to restore' },
    resolution_ready: { action: 'continue_resolution' as const, stateLabel: 'Restored · Story waiting' },
    complete: { action: null, stateLabel: 'Garden story complete' },
  }[status];
  return { ...presentation, level: chapter.level, order, orderComplete, status };
}

export function petalimpIslandReturnLevel(world: MergeWorldState): MossproutNatureIslandLevel | null {
  const campaign = world.islandCampaigns?.[PETALIMP_ISLAND_CAMPAIGN_ID];
  if (!campaign?.discoveryRevealSeenAt) return null;
  return PETALIMP_ISLAND_CHAPTERS.find((chapter) => petalimpIslandChapterStatus(world, chapter.level) === 'return_ready')?.level ?? null;
}

export function petalimpGrowthStyle(choiceIds: readonly (string | null | undefined)[]): PetalimpGrowthStyle {
  const scores: Record<PetalimpGrowthStyle, number> = { gentle: 0, curious: 0, together: 0 };
  choiceIds.forEach((choiceId, index) => {
    const choice = PETALIMP_ISLAND_CHAPTERS.flatMap((chapter) => chapter.choices).find((candidate) => candidate.id === choiceId);
    if (choice) scores[choice.growthStyle] += index === 3 ? 1.25 : 1;
  });
  const preference: PetalimpGrowthStyle[] = ['gentle', 'curious', 'together'];
  return (Object.entries(scores) as [PetalimpGrowthStyle, number][])
    .sort((left, right) => right[1] - left[1] || preference.indexOf(left[0]) - preference.indexOf(right[0]))[0]![0];
}

const branchConversationId = (baseId: string, choiceId?: string | null) => choiceId ? `${baseId}:${choiceId}` : baseId;

export function petalimpIslandReturnConversationId(level: MossproutNatureIslandLevel, choiceId?: string | null) {
  const chapter = petalimpIslandChapter(level);
  return chapter ? branchConversationId(chapter.returnConversationId, petalimpIslandChapterChoice(level, choiceId)?.id) : null;
}

export function petalimpIslandResolutionConversationId(level: MossproutNatureIslandLevel, choiceId?: string | null, growthStyle?: PetalimpGrowthStyle) {
  const chapter = petalimpIslandChapter(level);
  if (!chapter) return null;
  const branchId = branchConversationId(chapter.resolutionConversationId, petalimpIslandChapterChoice(level, choiceId)?.id);
  return level === 4 && growthStyle ? `${branchId}:${growthStyle}` : branchId;
}

const GROWTH_INSIGHTS: Record<PetalimpGrowthStyle, ConversationInsightResultDefinition> = {
  gentle: {
    id: 'gentle-grower', title: 'A Gentle Grower', emblemId: 'petalimp-growth-gentle', matchOptionIds: [],
    reflection: 'You often make change feel possible by finding a small, kind next step and leaving room to pause.',
    summary: 'Small steps and a gentle pace can help change feel possible for me.',
  },
  curious: {
    id: 'curious-cultivator', title: 'A Curious Cultivator', emblemId: 'petalimp-growth-curious', matchOptionIds: [],
    reflection: 'You often grow by experimenting, adapting, and letting a plan become something better than its first draft.',
    summary: 'Curiosity and flexible plans can help me grow through change.',
  },
  together: {
    id: 'companion-gardener', title: 'A Companion Gardener', emblemId: 'petalimp-growth-together', matchOptionIds: [],
    reflection: 'You often find momentum through company, shared care, and remembering that asking for help belongs in the process.',
    summary: 'Connection and shared care can help me keep growing.',
  },
};

const GROWTH_INSIGHT_CHOICES: Record<PetalimpGrowthStyle, { label: string; reply: string }> = {
  gentle: {
    label: 'We began with small steps',
    reply: 'We did. Each small return gave the next thing somewhere safe to grow.',
  },
  curious: {
    label: 'We let the plan change',
    reply: 'We did. The garden became more alive each time we listened instead of forcing the first plan.',
  },
  together: {
    label: 'We kept returning together',
    reply: 'We did. The care became easier to carry whenever neither of us carried it alone.',
  },
};

const baseDefinition = (id: string, title: string) => ({
  id, version: 2, familyId: 'mossprout' as const, speakerSkinId: 'petalimp' as const, title,
  trigger: 'evergreen' as const, minimumBondLevel: 1 as const, cooldownDays: 0, contextualOnly: true,
  format: 'narrative' as const, purpose: 'journey' as const, returnTarget: 'character_home' as const,
  repeatPolicy: 'once_ever' as const,
});

export const petalimpIslandConversationDefinitions: readonly ConversationDefinition[] = [
  ...PETALIMP_ISLAND_CHAPTERS.flatMap((chapter): ConversationDefinition[] => {
    const opening: ConversationDefinition = {
      ...baseDefinition(chapter.conversationId, chapter.title), entryNodeId: 'choice', returnTarget: 'garden',
      tags: ['island-campaign', 'petalimp', 'bloom-garden'],
      nodes: [
        {
          id: 'choice', kind: 'choice', phase: 'explore', prompt: chapter.prompt,
          helperText: 'Your answer shapes this garden, Petalimp’s request, and the Wisp that hears you.',
          options: chapter.choices.map((choice) => ({
            id: choice.id, label: choice.label, reply: choice.reply, nextNodeId: `end-${choice.id}`,
            wispAffinity: choice.wispAffinity,
          })),
        },
        ...chapter.choices.map((choice) => ({ id: `end-${choice.id}`, kind: 'end' as const, message: choice.openingConclusion })),
      ],
    };
    const fallbackReturn: ConversationDefinition = {
      ...baseDefinition(chapter.returnConversationId, chapter.title), entryNodeId: 'end',
      tags: ['island-campaign', 'petalimp', 'bloom-garden', 'return', 'required-narrative-overlay'],
      nodes: [{ id: 'end', kind: 'end', message: `Everything for ${chapter.title} is ready. The garden can be restored when it has enough Glow.` }],
    };
    const fallbackResolution: ConversationDefinition = {
      ...baseDefinition(chapter.resolutionConversationId, chapter.title), entryNodeId: 'end',
      tags: ['island-campaign', 'petalimp', 'bloom-garden', 'resolution', 'required-narrative-overlay'],
      nodes: [{ id: 'end', kind: 'end', message: chapter.level === 4
        ? 'Every bloom found room. We restored more than a garden; we made a welcome.'
        : 'The garden changed because we came back and cared for it together.' }],
    };
    const branches = chapter.choices.flatMap((choice): ConversationDefinition[] => {
      const choiceReturn: ConversationDefinition = {
        ...baseDefinition(branchConversationId(chapter.returnConversationId, choice.id), chapter.title), entryNodeId: 'end',
        tags: ['island-campaign', 'petalimp', 'bloom-garden', 'return', 'required-narrative-overlay'],
        nodes: [{ id: 'end', kind: 'end', message: choice.returnLine }],
      };
      if (chapter.level < 4) return [choiceReturn, {
        ...baseDefinition(branchConversationId(chapter.resolutionConversationId, choice.id), chapter.title), entryNodeId: 'end',
        tags: ['island-campaign', 'petalimp', 'bloom-garden', 'resolution', 'required-narrative-overlay'],
        nodes: [{ id: 'end', kind: 'end', message: choice.resolutionLine }],
      }];
      const finalResolutions = (['gentle', 'curious', 'together'] as const).map((style): ConversationDefinition => ({
        ...baseDefinition(`${branchConversationId(chapter.resolutionConversationId, choice.id)}:${style}`, chapter.title), entryNodeId: 'payoff',
        tags: ['island-campaign', 'petalimp', 'bloom-garden', 'resolution', 'final-insight', 'required-narrative-overlay'],
        nodes: [
          {
            id: 'payoff', kind: 'choice', phase: 'resolve', prompt: choice.resolutionLine,
            options: [{
              id: 'see-growth-insight', label: GROWTH_INSIGHT_CHOICES[style].label,
              reply: `${GROWTH_INSIGHT_CHOICES[style].reply} I noticed something about your way of growing, too.`, nextNodeId: 'insight',
            }],
          },
          {
            id: 'insight', kind: 'insight_reveal', title: 'Your way of growing right now',
            insightKey: 'petalimp:growth-style', category: 'Growth & change', persistence: 'offer_save',
            allowSecondary: false, results: [GROWTH_INSIGHTS[style]], nextNodeId: 'end',
          },
          { id: 'end', kind: 'end', message: 'Whatever grows next, this garden can remind us that your way of growing is allowed to change too.' },
        ],
      }));
      return [choiceReturn, ...finalResolutions];
    });
    return [opening, fallbackReturn, fallbackResolution, ...branches];
  }),
];
