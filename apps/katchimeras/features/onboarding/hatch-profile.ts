/** Authored evidence, not a diagnosis or a permanent personality score. */
export type HatchAnswer = {
  katchimeraId: string;
  definitionVersion: number;
  questionId: string;
  answerId: string;
  dimension: 'primaryFriction' | 'supportPreference';
  value: string;
  confidenceIncrement: number;
  tags: string[];
  timestamp: number;
};
export type HatchQuestion = {
  id: string;
  title: string;
  dimension: HatchAnswer['dimension'];
  options: readonly { id: string; label: string; reply: string }[];
};
export type HatchProfileDefinition = { katchimeraId: string; domain: string; version: number; questions: readonly HatchQuestion[] };
export const HATCH_ANSWER_BOND = 15;
export const HATCH_CLEANSE_MS = 700;
const question = (id: string, title: string, dimension: HatchQuestion['dimension'], options: readonly (readonly [string, string, string])[]): HatchQuestion => ({
  id, title, dimension, options: options.map(([value, label, reply]) => ({ id: value, label, reply })),
});
const profile = (katchimeraId: string, domain: string, friction: HatchQuestion, support: HatchQuestion): HatchProfileDefinition => ({ katchimeraId, domain, version: 1, questions: [friction, support] });
export const LEGACY_HATCH_PROFILES: Readonly<Record<string, HatchProfileDefinition>> = {
  mossprout: profile('mossprout', 'growth',
    question('friction', 'When you want to make progress, what usually tangles your roots first?', 'primaryFriction', [
      ['starting', 'I don’t know where to start', 'The beginning gets tangled sometimes.'],
      ['too_much', 'I take on too much', 'A whole forest can be a lot to grow at once.'],
      ['momentum', 'I lose momentum', 'Keeping something growing can be the tricky part.'],
      ['energy', 'I run out of energy', 'Sometimes there isn’t much energy left for growing.'],
    ]), question('support', 'When something feels stuck, what usually helps most?', 'supportPreference', [
      ['small_action', 'One tiny step', 'Good thing I’m rather fond of tiny beginnings.'],
      ['planning', 'A proper plan', 'We can find a little path before we plant anything.'],
      ['encouragement', 'Someone giving me a push', 'I can offer a little nudge. Surprisingly sturdy, these leaves.'],
      ['space', 'A little space first', 'Then we’ll leave a little breathing room around the roots.'],
    ])),
  steppling: profile('steppling', 'movement',
    question('friction', 'What usually keeps you still when you meant to get moving?', 'primaryFriction', [
      ['energy', 'I’m low on energy', 'Some days there isn’t much fuel for a big expedition.'],
      ['distraction', 'I get distracted', 'Other things can carry your attention off first.'],
      ['going_out', 'I don’t feel like going out', 'Getting out the door doesn’t always sound inviting.'],
      ['routine', 'I just forget', 'A walk can slip your mind when the day gets going.'],
    ]), question('support', 'What makes moving easier?', 'supportPreference', [
      ['audio', 'Music or a podcast', 'Then we can give our feet something good to listen to.'],
      ['exploration', 'Somewhere nice to go', 'Good. I was hoping we could find somewhere worth going.'],
      ['company', 'Someone coming with me', 'A companion for the road? I’m already here.'],
      ['goal', 'Having a reason or goal', 'Let’s give the next little outing a destination.'],
    ])),
  baristabbit: profile('baristabbit', 'routine',
    question('friction', 'What tends to spill your daily rhythm?', 'primaryFriction', [
      ['rushed', 'Rushed mornings', 'Mornings can run away before the kettle is warm.'],
      ['changing_plans', 'Plans keep changing', 'A changing day can knock the cups out of line.'],
      ['breaks', 'I forget to take a break', 'Sometimes the pause gets lost between everything else.'],
      ['energy', 'I run out of energy', 'There isn’t always another cup of energy waiting.'],
    ]), question('support', 'What helps you find your rhythm again?', 'supportPreference', [
      ['ritual', 'One small ritual', 'Then let’s keep one small familiar thing warm.'],
      ['planning', 'A simple plan', 'A little order on the counter. I like that.'],
      ['company', 'A moment with someone', 'There’s room for two at this counter.'],
      ['space', 'A little breathing room', 'We can leave a pause between cups.'],
    ])),
  shellio: profile('shellio', 'rest',
    question('friction', 'What makes it hardest for you to properly switch off?', 'primaryFriction', [
      ['thoughts', 'Too many thoughts', 'It can be hard to find quiet with so much on your mind.'], ['workload', 'Too much to do', 'A full day can follow you into your quiet time.'], ['input', 'Too much noise/input', 'Sometimes everything keeps asking for your attention.'], ['others', 'Other people’s stuff', 'Other people’s days can take up room in yours.'],
    ]), question('support', 'What actually helps you reset?', 'supportPreference', [
      ['quiet', 'Quiet', 'We can make a little quiet here.'], ['space', 'Getting away for a bit', 'A change of scene can leave a little space.'], ['audio', 'Something calming to listen to', 'Let’s find a softer sound.'], ['company', 'Talking to someone', 'I can stay and listen.'],
    ])),
  bedrotte: profile('bedrotte', 'sleep',
    question('friction', 'What tends to follow you under the covers?', 'primaryFriction', [
      ['thoughts', 'A busy mind', 'Thoughts don’t always notice bedtime.'], ['screens', 'One more thing to watch', 'One more can turn into quite a few.'], ['timing', 'An unpredictable bedtime', 'The day doesn’t always end on schedule.'], ['settling', 'I’m not ready to settle', 'Settling can take its own time.'],
    ]), question('support', 'What helps your day curl up and wind down?', 'supportPreference', [
      ['ritual', 'A familiar routine', 'We can keep a familiar little ending.'], ['quiet', 'A quiet room', 'Let’s turn the volume of the day down.'], ['reading', 'A few pages', 'A little story before the next dream.'], ['audio', 'A gentle sound', 'Something soft to drift alongside.'],
    ])),
  pagelet: profile('pagelet', 'reading',
    question('friction', 'What tends to keep the next page waiting?', 'primaryFriction', [
      ['time', 'Finding time', 'A page can wait behind a busy day.'], ['attention', 'My attention wanders', 'Sometimes the words have competition.'], ['choice', 'Choosing a book', 'So many doors, and only one bookmark.'], ['energy', 'I’m too tired', 'Even a good story can wait for a little energy.'],
    ]), question('support', 'What draws you into a book?', 'supportPreference', [
      ['story', 'A gripping story', 'Let’s find a story that wants to carry you.'], ['learning', 'Something to learn', 'There are lovely things hiding in pages.'], ['ritual', 'A cosy reading moment', 'A small cosy corner sounds just right.'], ['company', 'A recommendation', 'We can start with a friendly pointer.'],
    ])),
  encora: profile('encora', 'music',
    question('friction', 'When is it hard to find your tune?', 'primaryFriction', [
      ['noise', 'Everything feels noisy', 'Even music can need some room to arrive.'], ['choice', 'I don’t know what to play', 'A lot of songs can crowd the doorway.'], ['routine', 'I forget to make time', 'A day can go by without its soundtrack.'], ['mood', 'Nothing fits my mood', 'Sometimes your tune takes a little finding.'],
    ]), question('support', 'What kind of sound helps you find your way back?', 'supportPreference', [
      ['familiar', 'An old favourite', 'A familiar chorus can be good company.'], ['energy', 'Something with energy', 'We can look for a little lift.'], ['calm', 'Something gentle', 'Then we’ll start softly.'], ['discovery', 'Something new', 'There’s always another sound to meet.'],
    ])),
};

// Version 2 reauthors each trio as a distinct set. Version 1 stays readable for saved answers.
export const HATCH_PROFILES: Readonly<Record<string, HatchProfileDefinition>> = Object.fromEntries([
  profile('mossprout', 'growth',
    question('friction', 'What makes it hard to get going?', 'primaryFriction', [
      ['starting', 'Not sure where to start', 'The beginning gets tangled sometimes.'],
      ['overloaded', 'Too much on my plate', 'A crowded patch leaves little room for a new shoot.'],
      ['follow_through', 'Losing momentum', 'Keeping a little thing growing takes care, too.'],
    ]), question('support', 'What would help you get started?', 'supportPreference', [
      ['small_action', 'One tiny step', 'Good thing I’m rather fond of tiny beginnings.'],
      ['steady_guidance', 'A little guidance', 'We can find the next patch of light together.'],
      ['breathing_room', 'A little breathing room', 'Then we’ll leave room around the roots. No tugging.'],
    ])),
  profile('steppling', 'movement',
    question('friction', 'What gets in the way of going out?', 'primaryFriction', [
      ['energy', 'Too low on energy', 'Some days there isn’t much fuel for an expedition.'],
      ['pulled_away', 'Getting distracted', 'A busy day can carry you everywhere except outside.'],
      ['appeal', 'Not keen on going out', 'Then perhaps we need an outing worth looking forward to.'],
    ]), question('support', 'What makes going out more appealing?', 'supportPreference', [
      ['destination', 'Somewhere nice to explore', 'Good. I was hoping we could find somewhere worth going.'],
      ['company', 'Someone coming with me', 'A companion for the road? I’m already here.'],
      ['own_pace', 'Going at my own pace', 'No marching orders, then. We can follow your feet.'],
    ])),
  profile('baristabbit', 'routine',
    question('friction', 'What throws off your routine?', 'primaryFriction', [
      ['rushed', 'Rushed mornings', 'Some mornings outrun the kettle.'],
      ['unpredictable', 'Changing plans', 'A changing day can shuffle every cup on the counter.'],
      ['depleted', 'Not enough breaks', 'A pause can get lost when there’s always another thing to do.'],
    ]), question('support', 'What helps you get back on track?', 'supportPreference', [
      ['anchor_ritual', 'One small ritual', 'Let’s keep one small familiar thing warm.'],
      ['flexible_plan', 'Planning my next step', 'We can clear the counter and choose the next cup.'],
      ['shared_pause', 'A quick catch-up', 'There’s room for two at this counter.'],
    ])),
  profile('shellio', 'rest',
    question('friction', 'What makes it hard to switch off?', 'primaryFriction', [
      ['busy_mind', 'Too many thoughts', 'Thoughts don’t always notice when it’s quiet time.'],
      ['demands', 'Too many demands', 'It’s hard to pause when so much is still calling.'],
      ['sensory_load', 'Too much noise', 'Sometimes the world needs its volume turned down.'],
    ]), question('support', 'What helps you relax?', 'supportPreference', [
      ['quiet_space', 'Quiet time alone', 'We can leave some quiet around you.'],
      ['gentle_focus', 'Something soothing', 'A gentle sound or a small comfort can keep us company.'],
      ['talking', 'Someone to talk to', 'You can set a little of it down here. I’m listening.'],
    ])),
  profile('bedrotte', 'sleep',
    question('friction', 'What gets in the way of bedtime?', 'primaryFriction', [
      ['busy_mind', 'A busy mind', 'Thoughts don’t always put their pyjamas on in time.'],
      ['late_stimulation', 'One more thing to do', 'One more thing can make a very long bedtime story.'],
      ['irregular_endings', 'An unpredictable bedtime', 'Some days don’t leave a neat place to fold them up.'],
    ]), question('support', 'What helps you wind down?', 'supportPreference', [
      ['consistent_cue', 'A familiar routine', 'A little familiar ending. I can curl up with that.'],
      ['soothing_activity', 'Something calming', 'Something soft to follow toward the pillows.'],
      ['quiet_space', 'A quiet, dark room', 'Let’s turn the day down a little.'],
    ])),
  profile('pagelet', 'reading',
    question('friction', 'What makes it hard to read?', 'primaryFriction', [
      ['space_for_reading', 'Finding time', 'A busy day can leave a bookmark waiting.'],
      ['attention', 'Settling into the words', 'Sometimes it takes a while to step inside a page.'],
      ['fit', 'Finding the right book', 'So many doors. We can look for one you want to open.'],
    ]), question('support', 'What do you enjoy about reading?', 'supportPreference', [
      ['gripping_story', 'A gripping story', 'Let’s find a story that wants to carry you.'],
      ['new_perspective', 'Something to discover', 'There are lovely new ways of seeing tucked into pages.'],
      ['cozy_ritual', 'A cosy reading moment', 'A page, a cosy corner, and a little time that’s yours.'],
    ])),
  profile('encora', 'music',
    question('friction', 'What gets in the way of enjoying music?', 'primaryFriction', [
      ['crowded_head', 'Too much noise already', 'Even a song can need a little space to arrive.'],
      ['choosing_sound', 'Finding the right song', 'Sometimes the right tune takes a little finding.'],
      ['no_music_moment', 'Forgetting to make time', 'A day can slip by without its soundtrack.'],
    ]), question('support', 'What would you like from music?', 'supportPreference', [
      ['lift', 'A little lift', 'We can listen for a spark to move with.'],
      ['soften', 'A little calm', 'Then we’ll begin with something gentle.'],
      ['feel_understood', 'Something that fits my mood', 'A song that meets you where you are. I like that.'],
    ])),
].map((definition) => [definition.katchimeraId, { ...definition, version: 2 }]));

function hatchDefinition(companion: string, version: number) {
  return version === 1 ? LEGACY_HATCH_PROFILES[companion] : version === 2 ? HATCH_PROFILES[companion] : undefined;
}
export function makeHatchAnswer(companion: string, questionId: string, answerId: string, timestamp: number, definitionVersion = 2): HatchAnswer | null {
  const definition = hatchDefinition(companion, definitionVersion);
  const q = definition?.questions.find((item) => item.id === questionId);
  const option = q?.options.find((item) => item.id === answerId);
  if (!definition || !q || !option || !Number.isFinite(timestamp) || timestamp <= 0) return null;
  return { katchimeraId: companion, definitionVersion: definition.version, questionId, answerId, dimension: q.dimension, value: answerId, confidenceIncrement: 1, tags: [definition.domain, `${q.dimension}:${answerId}`], timestamp };
}
export function hatchProfileSummary(answers: readonly HatchAnswer[] = []) {
  const replies = answers.flatMap((answer) => {
    const option = hatchDefinition(answer.katchimeraId, answer.definitionVersion ?? 1)?.questions.find((q) => q.id === answer.questionId)?.options.find((item) => item.id === answer.answerId);
    return option ? [option.reply] : [];
  });
  return { primaryFriction: answers.find((a) => a.dimension === 'primaryFriction')?.value ?? null,
    supportPreference: answers.find((a) => a.dimension === 'supportPreference')?.value ?? null,
    currentAspiration: null, initialInsight: replies.join('\n\n'), initialProfileTags: answers.flatMap((a) => a.tags) };
}
