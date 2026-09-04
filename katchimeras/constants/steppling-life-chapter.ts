import type { LifeChoice } from '@/features/content-flow/companion-life-flow';

type Episode = { opening: string; choices: readonly LifeChoice[]; followup: string; followupChoices: readonly LifeChoice[]; bridge: string; resolution: string };
export const STEPPLING_LIFE_EPISODES: Readonly<Record<number, Episode>> = {
  1: {
    opening: 'Hi, I’m Steppling. I packed for a journey. Mostly snacks. What would feel good today?',
    choices: [
      ['walk', 'A little walk.', 'Lovely. A short path is still a path.', 'cue.walk'],
      ['adapted', 'Movement my way.', 'Your way, then. There’s no entrance exam.', 'cue.adapted'],
      ['rest', 'A gentle day.', 'Then we’ll leave room to pause.', 'cue.rest'],
    ],
    followup: 'When would that fit most easily?',
    followupChoices: [['after', 'After something I already do.', 'A familiar moment can remind us.'], ['break', 'When I notice I need a break.', 'We’ll keep it ready for that moment.'], ['choose', 'I’d rather decide each day.', 'Then the timing stays yours.']],
    bridge: 'I brought a little parcel for our Garden. Then I’ll rest for eight hours. When I’m back, we can find a reason for our first path.',
    resolution: 'Small counts. We have a place to begin.',
  },
  2: {
    opening: 'Our first path needs a destination. “Somewhere” is technically a destination, but I think we can improve it. What would you like a little movement to give you?',
    choices: [['headspace', 'Space in my head.', 'A little room away from the noise.'], ['purpose', 'A useful destination.', 'An errand can have a small adventure attached.'], ['company', 'Company.', 'Someone beside you can change the whole outing.'], ['discovery', 'Something to discover.', 'Excellent. I’ll appoint us Inspectors of Nearby Things.']],
    followup: 'Which version would fit an ordinary day?',
    followupChoices: [['walk', 'A short walking break.', 'A break with a little path in it.', 'habit.steppling:ten-minute-walk'], ['journey', 'Part of a journey I already make.', 'We’ll start with a journey that already belongs to your day.', 'habit.steppling:walk-one-journey'], ['adapted', 'A movement break where I am.', 'No destination needed. We can begin right here.', 'habit.steppling:adapted-break'], ['rest', 'Rest is what fits today.', 'Then today’s path can include a resting place.', 'habit.steppling:rest-break']],
    bridge: 'Let’s build our first village route. Every path needs a beginning.',
    resolution: 'There. Our first route. We know what you’d like movement to offer; we can find out what actually fits.',
  },
  3: {
    opening: 'I found something on the path. It was the path. I’d been looking at my snacks. What has caught your attention lately?',
    choices: [['noticed', 'A small detail.', 'Something easy to pass, until you don’t.'], ['company', 'Someone along the way.', 'A familiar face can become part of a place.'], ['adapted', 'How movement felt.', 'That’s worth noticing too.'], ['not_yet', 'Nothing comes to mind.', 'Then we’ve left ourselves something to discover.']],
    followup: 'What would you like to notice next time?',
    followupChoices: [['living', 'Something living.', 'A leaf, a bird, something determinedly growing.'], ['familiar', 'Something familiar I usually miss.', 'A second look at an ordinary place.'], ['feeling', 'How I feel before and after.', 'We’ll leave room for whatever the answer is.'], ['enjoy', 'I’d rather just enjoy it.', 'Then we’ll put the clipboard away.']],
    bridge: 'Let’s give our next route somewhere to stop and look.',
    resolution: 'Another route, and a reason to look around. We don’t have to bring back a discovery every time.',
  },
  4: {
    opening: 'I drew a magnificent route. Then I remembered hills exist. What makes starting difficult for you right now?',
    choices: [['time', 'Not much time.', 'Then our plan needs to fit the time that’s actually there.'], ['energy', 'Low energy.', 'We can make room for less.'], ['access', 'Finding a route that works for me.', 'The route should suit you.'], ['motivation', 'Getting started.', 'We can make the first part easier to reach.'], ['rest', 'I need rest today.', 'Then we start by listening to that.']],
    followup: 'Which adjustment sounds useful?',
    followupChoices: [['shorter', 'Make it shorter.', 'Two minutes can be the whole plan.', 'habit.steppling:two-minute-walk'], ['familiar', 'Use a familiar journey.', 'One less decision before beginning.', 'habit.steppling:walk-one-journey'], ['adapted', 'Move where I am.', 'We’ll bring the starting point to you.', 'habit.steppling:adapted-break'], ['rest', 'Make room for rest.', 'Rest gets a place on our map.', 'habit.steppling:rest-break']],
    bridge: 'Let’s build a route with somewhere to pause.',
    resolution: 'This path has room for difficult days. It doesn’t need you to become a different person before you use it.',
  },
  5: {
    opening: 'I’m getting fond of this path. Even the bend where I dropped lunch. What seems worth keeping in your own routine?',
    choices: [['short', 'Keeping it short.', 'Short enough to return to.'], ['purpose', 'Having a reason to go.', 'Something at the other end that matters to you.'], ['company', 'Sharing it with someone.', 'Company can be part of the invitation.'], ['adapted', 'Changing it to fit the day.', 'A routine with a little room to bend.'], ['unsure', 'I’m still finding out.', 'Then we’ll keep finding out.']],
    followup: 'What should we do with your daily habit?',
    followupChoices: [['keep', 'Keep it as it is.', 'We’ll leave that familiar place ready.'], ['change', 'Choose or change a habit.', 'Let’s choose something that fits better.', 'habit.picker'], ['pause', 'Pause it for now.', 'Paused. Our path is still here.', 'habit.pause']],
    bridge: 'Let’s finish another route. Familiar places can still grow.',
    resolution: 'Four routes. We can keep what works and change what doesn’t.',
  },
  6: {
    opening: 'Five routes, once we finish this last one. I was expecting one very long straight line. What belongs in our finished path?',
    choices: [['curiosity', 'Room for discovery.', 'A turn we haven’t looked around yet.'], ['company', 'Room for company.', 'Space to walk beside someone.'], ['adapted', 'Different ways to move.', 'More than one way to belong here.'], ['rest', 'Somewhere to pause.', 'A resting place is part of the path.']],
    followup: 'What would you like me to remember from our first chapter?',
    followupChoices: [['small', 'Small can be enough.', 'We’ll keep room for small.'], ['purpose', 'Having a reason matters to me.', 'We’ll start with what you want from the moment.'], ['adapt', 'I need room to adapt.', 'We’ll leave the plan open to change.'], ['finding', 'I’m still finding my way.', 'Then that’s where we’ll continue from.']],
    bridge: 'One last route. Then let’s bring The Path Outside together.',
    resolution: 'There it is. The Path Outside. It holds the ways we chose, including the places we stopped. I’m glad we made it together.',
  },
};
