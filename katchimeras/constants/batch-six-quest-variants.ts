type Variant = { id: string; title: string; hint: string };
const v = (title: string, hint: string, secondTitle: string, secondHint: string, thirdTitle: string, thirdHint: string): readonly Variant[] => [
  { id: 'original', title, hint }, { id: 'alternate', title: secondTitle, hint: secondHint }, { id: 'return', title: thirdTitle, hint: thirdHint },
];

export const BATCH_SIX_QUEST_VARIANTS: Readonly<Record<string, readonly Variant[]>> = {
  'quest-snuglet-care-photo': v(
    'Keep a caring moment privately', 'Write or record one real human-care moment without including another person’s private details.',
    'Keep the practical care', 'Note one real care task, routine, coordination, or advocacy action and what need it addressed.',
    'Keep the limit as well', 'Record one care moment and a limit, unmet need, or piece that required more support. You do not need to make it positive.',
  ),
  'quest-snuglet-care-detail': v(
    'Name the care that happened', 'Describe one real act of human care, the relationship or role involved without identifying details, and the need it addressed.',
    'Name care that was shared', 'Describe one real care need and how responsibility, information, or practical work was shared—or was not.',
    'Name the cared-for person’s choice', 'Describe one care moment where the other person’s preference, consent, communication, or autonomy shaped what happened.',
  ),
  'quest-snuglet-caregiver-pause': v(
    'Include the caregiver', 'Keep a note about one pause, boundary, adjustment, or request for support that included your needs in the care picture.',
    'Name a limit without solving it', 'Record one caregiver limit or unmet support need without requiring yourself to fix it today.',
    'Leave one thing undone', 'Keep one non-urgent task you delayed, delegated, reduced, or released and why that boundary mattered.',
  ),
  'quest-snuglet-weekly-review': v(
    'Read the care week', 'Review one real care moment, a repeated need or pressure, and one adjustment, boundary, support request, or unresolved gap.',
    'Review the load honestly', 'Name what care required, what support existed, and what was too much or unavailable without blaming either person.',
    'Review dignity and choice', 'Keep one moment when communication, consent, preference, privacy, or autonomy shaped care and what you learned.',
  ),

  'quest-waglet-companion-photo': v(
    'Keep a dog moment', 'Photograph your dog or a dog you care for during a safe, ordinary moment. Do not interrupt rest or create a pose the dog dislikes.',
    'Keep the dog’s choice', 'Photograph a safe moment when the dog chose an activity, place, distance, or rest. Give space if the dog disengages.',
    'Keep an adapted routine', 'Photograph your dog during a walk, play, care, travel, or quiet moment adapted to current needs.',
  ),
  'quest-waglet-care-detail': v(
    'Share one dog routine', 'Describe a real walk, play, reward-based training, comfort, or care moment and one concrete detail.',
    'Follow the dog’s choice', 'Describe one real moment when the dog approached, paused, opted out, sought space, or chose another activity and how you responded.',
    'Keep a change without diagnosing it', 'Describe one real change in routine, comfort, appetite, movement, or behaviour and whether qualified follow-up may be appropriate.',
  ),
  'quest-waglet-routine-note': v(
    'Notice without assuming', 'Keep one dog body-language signal, preference, or routine detail and leave room for uncertainty about its meaning.',
    'Notice the environment', 'Record how weather, noise, route, visitors, other animals, or space affected one real dog moment.',
    'Notice what helped comfort', 'Keep one real adjustment that supported rest, choice, distance, routine, or comfort.',
  ),
  'quest-waglet-weekly-review': v(
    'Read the shared dog week', 'Review one real dog moment, a routine or preference pattern, and one next care, connection, adaptation, or qualified follow-up choice.',
    'Review choice and space', 'Keep one pattern in when the dog engaged, rested, declined, or sought space and how you can keep respecting it.',
    'Review without diagnosing', 'Name one behaviour or routine change, what you directly observed, and whether you will simply watch or seek qualified advice.',
  ),

  'quest-whiskit-companion-photo': v(
    'Keep a cat moment', 'Photograph your cat or a cat you care for during a safe, ordinary moment. Do not interrupt rest, hiding, or disengagement.',
    'Keep the cat’s choice', 'Photograph a safe moment when the cat chose an activity, place, distance, or rest. Give space if the cat leaves.',
    'Keep a quiet habitat detail', 'Photograph the cat using a chosen resting, hiding, viewing, play, or care space without forcing interaction.',
  ),
  'quest-whiskit-enrichment-detail': v(
    'Follow the cat’s curiosity', 'Describe a real play, enrichment, comfort, observation, or care moment and one concrete detail.',
    'Follow disengagement too', 'Describe one real moment when the cat approached, paused, left, hid, or declined and how you respected the choice.',
    'Keep a change without diagnosing it', 'Describe one real change in routine, comfort, appetite, movement, or behaviour and whether qualified follow-up may be appropriate.',
  ),
  'quest-whiskit-pattern-note': v(
    'Notice without assuming', 'Keep one cat body-language signal, possible preference, resting place, or routine detail and leave room for uncertainty.',
    'Notice the environment', 'Record how noise, household change, visitors, other animals, resources, or space affected one real cat moment.',
    'Notice what helped comfort', 'Keep one real adjustment that supported rest, choice, hiding, routine, or comfort.',
  ),
  'quest-whiskit-weekly-review': v(
    'Read the shared cat week', 'Review one real cat moment, a routine or possible preference pattern, and one next care, connection, adaptation, or qualified follow-up choice.',
    'Review choice and space', 'Keep one pattern in when the cat engaged, rested, declined, hid, or sought space and how you can keep respecting it.',
    'Review without diagnosing', 'Name one behaviour or routine change, what you directly observed, and whether you will simply watch or seek qualified advice.',
  ),

  'quest-mendle-honest-checkin': v(
    'Keep one honest check-in', 'Name what is present and what support the next hour may need. “I’m not sure” and “I need human help” are valid.',
    'Separate feeling from demand', 'Keep one feeling or body signal and one expectation you can lower, without requiring the feeling to change.',
    'Name when self-help is not enough', 'Record that everyday tools do not fit or are not enough, and name a trusted human or appropriate service if one is available.',
  ),
  'quest-mendle-kind-action': v(
    'Choose one supportive action', 'Try one safe, familiar action that may offer comfort, grounding, practical relief, or connection, then note the honest effect.',
    'Choose human support', 'Contact a trusted person or appropriate support and note only what you want to remember. Do not include their private details.',
    'Stop an unhelpful exercise', 'Try a grounding or self-support exercise only if it fits; record stopping or changing it when it does not help.',
  ),
  'quest-mendle-repair-note': v(
    'Find a more accurate story', 'Notice one harsh or blaming interpretation and write a more accurate version without forcing positivity.',
    'Leave uncertainty in the story', 'Rewrite one absolute conclusion so it includes what you know, what you do not know, and what support may be needed.',
    'Question the unfair demand', 'Keep one expectation you would not place on someone else in the same situation and a fairer alternative.',
  ),
  'quest-mendle-weekly-review': v(
    'Notice what support fitted', 'Review without grading the week: what offered support, what did nothing, what felt worse, and what needs human or professional help.',
    'Review the pressure', 'Keep one demand that became lighter, stayed heavy, or needs practical change rather than more self-work.',
    'Keep a route to support', 'Name one trusted person, professional route, or practical support you want to remember. Do not include private contact details.',
  ),
};
