export type LifeCompanionFamily = 'mossprout' | 'steppling';
export type LifeHabit = { id: string; familyId: LifeCompanionFamily; title: string; actionPhrase: string };

export const LIFE_HABITS: readonly LifeHabit[] = [
  { id: 'mossprout:quiet-minute', familyId: 'mossprout', title: 'Take one quiet minute', actionPhrase: 'take a quiet minute' },
  { id: 'mossprout:window-view', familyId: 'mossprout', title: 'Notice nature from a window', actionPhrase: 'notice nature from a window' },
  { id: 'mossprout:notice-living-thing', familyId: 'mossprout', title: 'Notice one nearby living detail', actionPhrase: 'notice something living' },
  { id: 'mossprout:drink-water', familyId: 'mossprout', title: 'Drink a glass of water', actionPhrase: 'have a glass of water' },
  { id: 'mossprout:check-plant', familyId: 'mossprout', title: 'Check on a plant', actionPhrase: 'see what your plant needed' },
  { id: 'steppling:ten-minute-walk', familyId: 'steppling', title: 'Take a short walk', actionPhrase: 'take a short walk' },
  { id: 'steppling:adapted-break', familyId: 'steppling', title: 'Take a brief movement break in a way that suits me', actionPhrase: 'move in a way that suited you' },
  { id: 'steppling:rest-break', familyId: 'steppling', title: 'Take a deliberate rest break', actionPhrase: 'take a deliberate rest break' },
  { id: 'steppling:walk-one-journey', familyId: 'steppling', title: 'Walk part of an everyday journey', actionPhrase: 'walk part of an everyday journey' },
  { id: 'steppling:two-minute-walk', familyId: 'steppling', title: 'Take a two-minute walk', actionPhrase: 'take a two-minute walk' },
];
export const lifeHabitById = new Map(LIFE_HABITS.map((habit) => [habit.id, habit]));

export const MOSSPROUT_FOLLOWUPS = {
  calm: { prompt: 'What would you like a little space from?', options: [
    { id: 'demands', label: 'Too many things asking for me.', reply: 'Then our little moment won’t need anything finished.', habitId: 'mossprout:quiet-minute' },
    { id: 'busy_thoughts', label: 'My thoughts are busy.', reply: 'We could give your attention somewhere simple to land. A leaf has very few demands.', habitId: 'mossprout:window-view' },
    { id: 'pause', label: 'I’m not sure. Just a pause.', reply: 'A pause is enough of an answer.', habitId: 'mossprout:quiet-minute' },
  ] },
  progress: { prompt: 'What would make a small beginning feel useful?', options: [
    { id: 'easy_start', label: 'Something easy to start.', reply: 'Then we’ll start with noticing. No equipment. Extremely modest paperwork.', habitId: 'mossprout:notice-living-thing' },
    { id: 'self_care', label: 'Remembering to care for myself.', reply: 'We’ve both done a lot of arriving. A drink of water could be a start.', habitId: 'mossprout:drink-water' },
    { id: 'care', label: 'Looking after something.', reply: 'Something living, then. First we notice what it needs.', habitId: 'mossprout:check-plant' },
  ] },
  unsure: { prompt: 'No grand plan needed. What sounds nicest?', options: [
    { id: 'peaceful', label: 'Something peaceful.', reply: 'We can make room for one quiet minute.', habitId: 'mossprout:quiet-minute' },
    { id: 'curious', label: 'Something curious.', reply: 'Good. I have several questions about that pebble.', habitId: 'mossprout:notice-living-thing' },
    { id: 'company', label: 'Just getting to know you.', reply: 'Then let’s do that. The pebble can wait.', habitId: null },
  ] },
} as const;

export function mossproutFollowup(intent: string | null | undefined) {
  const key = intent?.replace('desired-help:', '');
  return MOSSPROUT_FOLLOWUPS[key === 'calm' || key === 'unsure' ? key : 'progress'];
}
export function mossproutFollowupChoice(id: string | null | undefined) {
  return Object.values(MOSSPROUT_FOLLOWUPS).flatMap((question) => [...question.options]).find((option) => `life:${option.id}` === id);
}

export const LIFE_OUTCOMES = [
  { id: 'helped', label: 'It gave me what I needed.', reply: 'That sounds worth remembering. We can leave room for it again.' },
  { id: 'different', label: 'Something different, but good.', reply: 'An unexpected good thing. That belongs in our Journal too.' },
  { id: 'not_helpful', label: 'It didn’t help much.', reply: 'Useful to know. We can try a different shape.' },
] as const;
