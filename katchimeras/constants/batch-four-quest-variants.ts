type Variant = { id: string; title: string; hint: string };
const v = (title: string, hint: string, secondTitle: string, secondHint: string, thirdTitle: string, thirdHint: string): readonly Variant[] => [
  { id: 'original', title, hint },
  { id: 'alternate', title: secondTitle, hint: secondHint },
  { id: 'return', title: thirdTitle, hint: thirdHint },
];

export const BATCH_FOUR_QUEST_VARIANTS: Readonly<Record<string, readonly Variant[]>> = {
  'quest-cheerlet-progress-detail': v(
    'Why does this effort matter?', 'Describe one real effort, change, boundary, ending, or survival moment and why it deserves fair acknowledgement.',
    'What moved before the finish?', 'Describe one concrete part of unfinished progress and why that movement matters to you.',
    'What almost went uncredited?', 'Keep one real contribution or adaptation you nearly dismissed and explain its value without comparing it.',
  ),
  'quest-vesperitt-night-detail': v(
    'How chosen was the night?', 'Describe one real late-night moment, what filled it, and whether it felt chosen, mixed, unavoidable, or drifted.',
    'Where did choice meet constraint?', 'Keep one moment from a late night and separate what you chose from what work, care, health, stress, or wakefulness decided.',
    'What did the night give or cost?', 'Describe a real late hour and one value, cost, or unclear effect without judging the schedule itself.',
  ),
  'quest-dawnle-first-light-photo': v(
    'Catch an early-morning detail', 'If you are already awake and it suits you, photograph one real morning detail before 8am. There is no need to wake early for this quest.',
    'Keep the view from your morning', 'Before 8am, photograph light, weather, a room, a drink, a journey, or another safe detail from where you already are.',
    'Notice an ordinary early start', 'If your day happens to begin before 8am, photograph one ordinary detail without making the start look productive or ideal.',
  ),
  'quest-dawnle-morning-note': v(
    'Name what shaped the start', 'Keep a short note about the first action, need, cue, or interruption that shaped your day’s beginning.',
    'Notice what arrived first', 'Record what asked for your attention first and whether that fitted what you needed.',
    'Keep an adapted beginning', 'Note one way you made the start smaller, later, kinder, or more workable—or why you could not.',
  ),
  'quest-dawnle-prepare-start': v(
    'Prepare one easier beginning', 'Prepare one small cue for your next start, then note whether it helped, did nothing, or no longer fitted.',
    'Remove one morning decision', 'Set out or decide one useful thing in advance, then record whether that reduced effort when your day began.',
    'Prepare for limited capacity', 'Make one next start easier for a low-energy or busy day, then keep what worked or what still got in the way.',
  ),
  'quest-dawnle-weekly-review': v(
    'Read the week’s beginnings', 'Review how your days began, including late or disrupted starts. Keep one cue, condition, or adaptation worth remembering.',
    'Review what was outside your control', 'Notice which starts were shaped by sleep, health, work, care, or other demands and what support was realistic.',
    'Choose one flexible cue', 'Compare the week’s beginnings and choose one small cue to reuse without turning it into a rule.',
  ),

  'quest-quietome-one-line': v(
    'Keep one honest line', 'Write one line about what is present without requiring yourself to explain, solve, or improve it.',
    'Name a need, not a solution', 'Write one line about what you may need now. “I’m not sure” is a complete answer.',
    'Keep one grounded observation', 'Write one line about something you can notice in your feelings, body, surroundings, or thoughts right now.',
  ),
  'quest-quietome-solo-pause': v(
    'Choose a low-input pause', 'Take a brief pause with less input if it feels supportive, then note what became noticeable. Stop or seek company if quiet feels worse.',
    'Change one source of input', 'Reduce one sound, screen, conversation, or demand briefly, then note whether the change helped, unsettled, or did nothing.',
    'Use supported reflection', 'Pause with a grounding prompt, familiar object, or trusted person nearby, then keep one honest observation.',
  ),
  'quest-quietome-returning-question': v(
    'Return without forcing an answer', 'Spend a brief moment with one recurring question and record what shifted or remained unresolved.',
    'Make the question gentler', 'Rewrite one difficult question into a fairer, smaller, or more answerable form and keep the change.',
    'Choose to leave it open', 'Name one question you are not ready or able to answer and why leaving it open is appropriate now.',
  ),
  'quest-quietome-weekly-review': v(
    'Read the week’s reflection', 'Review what became clearer, what stayed open, and when quiet, input, or support fitted best.',
    'Review when quiet did not help', 'Notice one time reflection became circular, isolating, or demanding and what helped you stop or reconnect.',
    'Keep one honest thread', 'Choose one observation or question worth carrying forward and let the rest remain unfinished.',
  ),

  'quest-late-capture': v(
    'Keep a naturally late moment', 'If you are already awake between 11pm and 5am, photograph a safe detail from the night. Do not stay awake or go out for this quest.',
    'Catch the small hours from where you are', 'While naturally awake between 11pm and 5am, photograph light, work, care, comfort, weather, or another honest detail nearby.',
    'Keep an ordinary late hour', 'If a late hour is already part of tonight, photograph one ordinary detail without making the night look meaningful or ideal.',
  ),
  'quest-vesperitt-night-note': v(
    'Name what filled the late hours', 'Keep a short note about a real late night, what filled it, and whether it felt chosen, mixed, unavoidable, or drifted.',
    'Notice where the night changed', 'Record the point when a late night became more chosen, less chosen, or simply necessary.',
    'Keep the constraint in the story', 'Note a late-night responsibility, schedule, stressor, or wakeful period and what was—or was not—within your control.',
  ),
  'quest-vesperitt-next-day-note': v(
    'Notice one next-day effect', 'After a recent late night, note one effect on energy, mood, attention, body, or plans without treating it as a verdict.',
    'Notice no clear effect', 'Record whether a recent late night had a clear next-day effect, a mixed effect, or no effect you could identify.',
    'Notice what supported the next day', 'After a chosen or unavoidable late night, keep one support, adjustment, or condition that mattered the next day.',
  ),
  'quest-vesperitt-weekly-review': v(
    'Read the week’s night pattern', 'Review which late nights felt chosen, drifted, or unavoidable and what you want to protect, support, or change.',
    'Review the trade-offs', 'Compare what late nights gave you with any next-day costs, without assuming the earlier night was automatically better.',
    'Review what is yours to change', 'Separate one late-night condition within your control from one that is not, then choose a kind next step—or none.',
  ),

  'quest-cheerlet-name-progress': v(
    'Give one change fair credit', 'Keep a short note about one effort, movement, beginning, ending, or act of getting through that deserves fair acknowledgement.',
    'Name progress before the finish', 'Record one concrete thing that changed even though the wider work or chapter is unfinished.',
    'Credit what did not look like a win', 'Keep one effort, boundary, adaptation, or ending that mattered without forcing a positive spin.',
  ),
  'quest-cheerlet-celebrate-note': v(
    'Say what deserves acknowledgement', 'Record a brief voice note about an effort, change, milestone, or survival moment worth recognising. Celebration is optional.',
    'Give yourself spoken credit', 'Record a private voice note naming what you did, what it took, and why it counts.',
    'Let the feeling be mixed', 'Record a voice note about a meaningful change that brings pride, relief, sadness, uncertainty, or several feelings at once.',
  ),
  'quest-cheerlet-mark-chapter': v(
    'Mark the chapter honestly', 'Keep what changed, what it took, and what or who supported you. Include mixed feelings if they belong.',
    'Keep a beginning or ending', 'Record one concrete trace of something beginning, ending, pausing, or changing shape.',
    'Remember without sharing', 'Keep a private memory from this chapter and what you want your future self to understand about it.',
  ),
  'quest-cheerlet-weekly-review': v(
    'Gather the week’s real progress', 'Review effort, support, survival, beginnings, endings, and unfinished movement that deserve fair credit.',
    'Review what you overlooked', 'Find one concrete contribution or adaptation you nearly dismissed and record why it mattered.',
    'Acknowledge without comparing', 'Keep one piece of this week’s progress on its own terms, without comparing its size, speed, or visibility.',
  ),
};
