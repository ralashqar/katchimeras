type Variant = { id: string; title: string; hint: string };
const v = (title: string, hint: string, secondTitle: string, secondHint: string, thirdTitle: string, thirdHint: string): readonly Variant[] => [
  { id: 'original', title, hint }, { id: 'alternate', title: secondTitle, hint: secondHint }, { id: 'return', title: thirdTitle, hint: thirdHint },
];

export const BATCH_FIVE_QUEST_VARIANTS: Readonly<Record<string, readonly Variant[]>> = {
  'quest-flexel-session-note': v(
    'Keep one training moment', 'Log a real strength, gym, mobility, seated, or adapted training moment and what you chose to do.',
    'Keep a smaller session', 'Log a real training or mobility moment you shortened, simplified, or adapted to fit your capacity.',
    'Keep a recovery-led session', 'Log a real warm-up, technique, mobility, or low-load session where recovery needs shaped the plan.',
  ),
  'quest-flexel-training-detail': v(
    'Name what you trained', 'Describe a real strength, gym, mobility, seated, or adapted session and one exercise, support, technique, range, or body-response detail.',
    'Keep one adaptation', 'Describe a real training moment, what you adapted, and how that changed the fit.',
    'Keep one stopping decision', 'Describe a real session and one moment you reduced, changed, or stopped an activity in response to your body or circumstances.',
  ),
  'quest-flexel-recovery-note': v(
    'Train, then listen', 'After a real training moment, note one body response and one recovery, adaptation, or rest choice.',
    'Notice delayed feedback', 'Keep one response you noticed later after training and what you chose to do with that information.',
    'Let recovery lead', 'Record one time recovery needs changed the length, load, movement, timing, or decision to train.',
  ),
  'quest-flexel-weekly-review': v(
    'Read the training week', 'Review one real training example, what it showed about fit or technique, and one realistic continuation, adaptation, or pause.',
    'Review access and recovery', 'Keep one way access, pain, energy, equipment, support, or recovery shaped training this week and what would help.',
    'Review without comparison', 'Choose one useful movement, skill, adaptation, or boundary from the week without comparing load, appearance, or output.',
  ),

  'quest-sprintail-run-day': v(
    'A movement day around running', 'On a day you already choose to run or run-walk, reach 3,000 total steps from all movement. This threshold does not prove a run; skip it if it does not fit.',
    'Let everyday steps join the run', 'If you already plan a run or run-walk, let all safe daily movement count toward 3,000 total steps. Do not add movement just to satisfy the number.',
    'Use the threshold honestly', 'Reach 3,000 total steps on a chosen running day only if that level suits you. A shorter or adapted run can still matter even when this quest stays incomplete.',
  ),
  'quest-sprintail-run-detail': v(
    'Keep one run detail', 'Describe a real run or run-walk and one pace, interval, duration, route, condition, or body-response detail.',
    'Keep one adaptation', 'Describe a real run when you slowed, walked, shortened, changed route, or stopped and what informed that choice.',
    'Keep what made the run fit', 'Describe a real run or run-walk and one support, condition, route feature, or pacing choice that made it workable.',
  ),
  'quest-sprintail-recovery': v(
    'Notice the finish', 'After a real run or run-walk, note one body or energy response and what recovery, adaptation, or rest you chose.',
    'Notice the hours after', 'Keep one response that appeared later after a run and what it suggested without diagnosing or scoring it.',
    'Choose no next run yet', 'Record a recovery need from a recent run and give yourself permission not to set the next run now.',
  ),
  'quest-sprintail-weekly-review': v(
    'Read the running week', 'Review one real run or run-walk, what it showed, and one realistic next step, adaptation, recovery choice, or pause.',
    'Review pace without ranking it', 'Keep one thing you learned about sustainable effort without treating faster or farther as automatically better.',
    'Review the conditions', 'Notice how route, weather, safety, access, pain, energy, or recovery shaped running and what is—or is not—yours to change.',
  ),

  'quest-hooplet-court-note': v(
    'Keep one basketball moment', 'Log a real basketball practice, shoot-around, game, wheelchair or adapted session, solo skill moment, or guided learning activity.',
    'Keep a smaller practice', 'Log a brief or adapted basketball moment and what made that amount enough.',
    'Keep basketball beyond competition', 'Log a cooperative, solo, learning, officiating, coaching, or recreational basketball moment that mattered to you.',
  ),
  'quest-hooplet-skill-detail': v(
    'Work one basketball detail', 'Describe a real basketball moment and one shot, handle, pass, defensive read, decision, drill, team, or adaptation detail.',
    'Keep one decision', 'Describe a real practice or play and one choice you made before, during, or after the action.',
    'Keep one adaptation', 'Describe a real basketball moment, what you adapted in the setup, movement, equipment, rules, or expectation, and how it fitted.',
  ),
  'quest-hooplet-team-moment': v(
    'Notice shared basketball', 'Keep one real moment of communication, support, decision-making, inclusion, or shared play.',
    'Notice belonging or its absence', 'Record one basketball moment when a person, rule, space, or action affected whether you felt welcome.',
    'Notice support off the ball', 'Keep one contribution through communication, positioning, encouragement, access, or attention that did not depend on scoring.',
  ),
  'quest-hooplet-weekly-review': v(
    'Read the basketball week', 'Review one real basketball moment, a skill, access, or teamwork pattern, and one next focus, adaptation, or pause.',
    'Review without the scoreboard', 'Keep one useful basketball detail from the week that mattered regardless of points, winning, speed, or comparison.',
    'Review access and fit', 'Notice what helped or limited court, equipment, body, confidence, or people fit and choose one realistic response.',
  ),

  'quest-serveling-session-note': v(
    'Keep one racket-sport moment', 'Log a real tennis or racket-sport practice, match, cooperative hit, seated or adapted session, or solo skill moment.',
    'Keep a smaller practice', 'Log a brief or adapted racket-sport moment and what made that amount enough.',
    'Keep play without scoring', 'Log a cooperative rally, solo practice, lesson, or recreational moment where points did not need to matter.',
  ),
  'quest-serveling-rally-detail': v(
    'Keep one racket-sport detail', 'Describe a real session and one serve, stroke, return, rally, decision, positioning, or adaptation detail.',
    'Keep one adjustment', 'Describe a real point, attempt, or rally and one change you made to pace, position, grip, target, equipment, or expectation.',
    'Keep one cooperative pattern', 'Describe a real cooperative hit or rally and what helped both players sustain or enjoy it.',
  ),
  'quest-serveling-reset-note': v(
    'Reset between attempts', 'Keep a note about one breath, cue, adjustment, pause, or recovery choice between points or attempts.',
    'Reset after a difficult moment', 'Record one response after an error, discomfort, disagreement, or pressured point that helped—or did not help.',
    'Remove the score', 'Notice how your reset changed when you practised without scoring, ranking, or match pressure.',
  ),
  'quest-serveling-weekly-review': v(
    'Read the racket-sport week', 'Review one real session, a skill, access, partner, or composure pattern, and one next focus, adaptation, or pause.',
    'Review without ranking play', 'Keep one useful detail that mattered regardless of winning, pace, conventional technique, or comparison.',
    'Review access and fit', 'Notice what helped or limited court, equipment, body, partner, weather, or pressure fit and choose one realistic response.',
  ),
};
