import type { ConversationPollSeed, ConversationTraitTags } from '@/types/companion-conversation';

/**
 * Steppling's daily "play" questions: one tiny scenario each, answered in a
 * tap, followed by the village's fictional poll. Nobody is asked how organised
 * they are. Each answer quietly tags a trait or two (`traits`), which is how
 * the player learns something about themselves almost by accident, and how a
 * later insight can be grounded in what they actually chose.
 *
 * Voice: Steppling is warm, keen, and always slightly ready to leave. Replies
 * are one or two short lines and never grade the answer.
 */
const seed = (
  id: string,
  title: string,
  prompt: string,
  answers: readonly (readonly [label: string, reply: string, traits?: ConversationTraitTags | null])[],
  ending: string,
  bond?: 1 | 2 | 3 | 4,
): ConversationPollSeed => ({
  id, title, prompt,
  labels: answers.map(([label]) => label),
  replies: answers.map(([, reply]) => reply),
  traits: answers.map(([, , traits]) => traits ?? null),
  ending,
  ...(bond ? { bond } : {}),
});

export const STEPPLING_SCENARIO_POLLS: readonly ConversationPollSeed[] = [
  seed('free-day', 'A whole free day', 'You wake up to an entire day with nothing planned. What happens first?', [
    ['🌿 I disappear somewhere peaceful', 'Somewhere with trees and no signal. I’ll carry the snacks.', { rest: 2 }],
    ['🗺️ I go somewhere without much of a plan', 'No plan is my favourite plan. Boots on.', { spontaneity: 2, novelty: 1 }],
    ['🎨 I finally do that thing I keep thinking about', 'The thing you keep thinking about has been waiting for a free day. Good.', { making: 2 }],
    ['🛋️ Absolutely nothing, and it’s glorious', 'Nothing, done properly, is an activity. I respect it.', { rest: 2 }],
  ], 'Free days are rare. I’ve written down what you’d do with one.'),
  seed('unmapped-path', 'A path not on the map', 'There’s a path off the trail that isn’t on the map. What do you do?', [
    ['👀 I’m already halfway down it', 'Halfway down already. I’ll catch up.', { spontaneity: 2, curiosity: 1 }],
    ['🧭 I want to know where it goes, but I check first', 'Check first, then go. That’s how you get back in time for tea.', { curiosity: 1, caution: 1 }],
    ['👥 Only if someone comes with me', 'Company makes a path braver. I’ll come.', { social: 2 }],
    ['🌳 The main trail exists for a reason', 'Sensible. The main trail also has fewer nettles.', { caution: 2, routine: 1 }],
  ], 'Every walker answers that one differently. Noted.'),
  seed('exciting-idea', 'An exciting idea', 'You’ve got an idea you’re really excited about. What usually happens next?', [
    ['⚡ I start immediately', 'Straight in. The plan can catch up.', { spontaneity: 2 }],
    ['📋 I make a plan', 'A plan. The idea will thank you later.', { planning: 2 }],
    ['💭 I think about it for ages first', 'Thinking is a kind of starting. A slow, quiet kind.', { overthinking: 1, caution: 1 }],
    ['😅 I get another exciting idea', 'Two ideas, one walk. I know that feeling.', { curiosity: 1, spontaneity: 1 }],
  ], 'Ideas are like trailheads. You’ve told me which kind you take.'),
  seed('cancelled-plans', 'Plans cancelled', 'Someone cancels plans you secretly didn’t want to go to. What’s your first feeling?', [
    ['🎉 Freedom', 'Freedom. The evening is suddenly enormous.', { solitude: 2 }],
    ['😌 Relief', 'Relief. Feet up, or feet out. Your choice.', { rest: 1, solitude: 1 }],
    ['😕 Slight disappointment anyway', 'Disappointed anyway. Part of you was ready.', { social: 1 }],
    ['📱 Okay, who else is around?', 'Straight onto the next plan. Social to the last.', { social: 2 }],
  ], 'Cancelled plans tell you what you actually wanted. Interesting.'),
  seed('sealed-box', 'A sealed box', 'On the trail there’s a box marked OPEN WHEN READY. What do you do?', [
    ['📦 Open it immediately', 'Open. Ready is a state of mind.', { spontaneity: 2 }],
    ['👀 Shake it first', 'Shake first. Science.', { curiosity: 2 }],
    ['🕰️ Save it for the right moment', 'Saved for the right moment. You have patience I lack.', { planning: 1, rest: 1 }],
    ['🤨 Who left this here?', 'Suspicious. Fair. Boxes don’t leave themselves.', { caution: 2 }],
  ], 'I’d have opened it. I’m not proud.'),
  seed('compliment', 'The compliment that sticks', 'Which compliment stays with you longest?', [
    ['❤️ “You’re a good person.”', 'Kindness. That’s the one you keep.', { support_stay: 1 }],
    ['🧠 “You’re really good at what you do.”', 'Being good at it. You like the work to show.', { ambition: 2 }],
    ['✨ “There’s something different about you.”', 'Different. You’d rather be a path than a road.', { novelty: 2 }],
    ['😂 “You’re so much fun to be around.”', 'Fun. You want people to leave lighter.', { social: 2 }],
  ], 'I’ll remember which one to say.'),
  seed('plan-goes-wrong', 'When the plan goes wrong', 'The route you were excited about is closed. What’s most like you?', [
    ['🔧 Find another way', 'Another way. There’s always another way.', { resilience: 2 }],
    ['😤 Be annoyed for a while, then recover', 'Annoyed, then fine. Honest.', { resilience: 1, overthinking: 1 }],
    ['🌀 Overthink what went wrong', 'Overthinking. The route didn’t do it on purpose.', { overthinking: 2 }],
    ['🌊 Shrug and see where the day goes instead', 'Shrug. Days have their own ideas.', { spontaneity: 1, optimism: 1 }],
  ], 'Closed routes find out who you are. Noted, gently.'),
  seed('room-of-strangers', 'A room full of strangers', 'You walk into a gathering where you barely know anyone. Where do you end up?', [
    ['🗣️ Talking to whoever’s nearest', 'Whoever’s nearest. Brave.', { social: 2 }],
    ['👯 Finding the one person I know', 'The one person you know. A safe harbour.', { social: 1, caution: 1 }],
    ['🐚 Somewhere quieter with two interesting people', 'Two interesting people and a quiet corner. The best rooms are small.', { solitude: 1, curiosity: 1 }],
    ['🍕 Near the food until something happens', 'By the food. Excellent strategy. Things always happen near food.', { rest: 1, solitude: 1 }],
  ], 'I’d be near the food. We’d get on.'),
  seed('cant-do-that', 'Told you can’t', 'Someone says “You can’t do that.” What happens inside?', [
    ['🔥 Now I definitely want to', 'Now you want to. I know the feeling.', { ambition: 1, spontaneity: 1 }],
    ['🤔 Maybe they have a point', 'Maybe they’re right. Listening is underrated.', { caution: 2 }],
    ['🧠 I start figuring out how', 'Figuring out how. Already.', { ambition: 1, planning: 1 }],
    ['🍃 Depends whether I cared in the first place', 'Depends if you cared. Fair. Not every hill.', { rest: 1 }],
  ], 'Some hills are worth it. You’ve told me which.'),
  seed('empty-room', 'An empty room', 'You’re given a beautiful empty room. What do you add first?', [
    ['🪴 Something alive', 'Something alive. A plant, or me.', { optimism: 1, curiosity: 1 }],
    ['🛋️ Somewhere comfortable', 'Comfort first. A room is for sitting in.', { rest: 2 }],
    ['🎨 Something that feels like me', 'Something that’s yours. Rooms should know who lives there.', { making: 2 }],
    ['📚 Something useful', 'Useful first. The rest can arrive later.', { planning: 2 }],
  ], 'I’d add boots by the door. Then the plant.'),
  seed('which-mistake', 'Which mistake bothers you more?', 'Which mistake bothers you more?', [
    ['🚪 Not trying something I wanted', 'Not trying. That one lingers.', { ambition: 1, spontaneity: 1 }],
    ['💥 Trying and getting it badly wrong', 'Getting it wrong, loud and public. I know.', { caution: 2 }],
  ], 'That’s your risk compass. I’ll keep it in my pack.'),
  seed('friend-bad-day', 'A friend’s bad day', 'A friend is having a rough day. What’s your instinct?', [
    ['💬 Let them talk', 'Let them talk. You’re a good place to put things down.', { support_listen: 2 }],
    ['🛠️ Help solve the problem', 'Fix it. Practical love.', { support_fix: 2 }],
    ['😂 Try to lift their mood', 'Lift the mood. You bring the weather with you.', { support_cheer: 2 }],
    ['🫶 Just stay nearby', 'Stay nearby. Sometimes that’s the whole job.', { support_stay: 2 }],
  ], 'That’s probably how you’d like it too. I’ll remember.'),
  seed('fallen-behind', 'Falling behind', 'You realise you’ve fallen behind on something important. Which thought comes first?', [
    ['🌱 “Just do one bit.”', 'One bit. That’s how everything gets done.', { resilience: 2 }],
    ['📋 “I need a proper plan.”', 'A plan. Good. Plans are maps.', { planning: 2 }],
    ['😬 “How did I let this happen?”', 'How did this happen. Be kind. It happens to everyone.', { overthinking: 2 }],
    ['🙈 “Tomorrow-me can handle this.”', 'Tomorrow-you. Brave. Leave them a note.', { avoidance: 2 }],
  ], 'Falling behind isn’t the story. Starting again is.'),
  seed('travel-memory', 'The moment you keep', 'You’ve been somewhere new. Which moment stays with you?', [
    ['🌄 The view', 'The view. Worth every step.', { curiosity: 1 }],
    ['🍜 Something I ate', 'Something you ate. Snacks are memories.', { rest: 1 }],
    ['😂 Something ridiculous that happened', 'The ridiculous bit. Always the best story.', { spontaneity: 1, optimism: 1 }],
    ['💬 Someone I met', 'Someone you met. People are the map.', { social: 2 }],
    ['🗺️ The feeling of being somewhere unfamiliar', 'The unfamiliar feeling. That’s why you go.', { novelty: 2 }],
  ], 'That’s what you travel for. I’ll pack accordingly.'),
  seed('old-song', 'An old song', 'A song you loved years ago comes on. What gets you first?', [
    ['💭 The memories', 'The memories. Songs are paths back.'],
    ['🎵 The music itself', 'The music. Pure and simple.', { making: 1 }],
    ['🥲 The person I was back then', 'Who you were then. Say hello from me.', { overthinking: 1 }],
    ['💃 I’m already singing it', 'Singing already. Volume optional.', { spontaneity: 2 }],
  ], 'Add it to the walking playlist. I have one.'),
  seed('old-notebook', 'Your younger self’s notebook', 'You find a notebook from your younger self. What do you most want to see?', [
    ['✨ What I dreamed of becoming', 'The dreams. Some of them walked here with you.', { ambition: 2 }],
    ['😂 What I thought was important', 'What mattered then. Probably snacks.', { curiosity: 1 }],
    ['❤️ Who mattered to me', 'Who mattered. They probably still do.', { social: 2 }],
    ['🧠 Whether I’m still the same person', 'Whether you’re the same. Partly. The good parts.', { overthinking: 1 }],
  ], 'Younger you would like where you’re walking now.'),
  seed('feels-better', 'Which feels better?', 'Which feels better?', [
    ['✅ Finishing something difficult', 'Finishing. Summit energy.', { ambition: 1, resilience: 1 }],
    ['🌱 Starting something exciting', 'Starting. Trailhead energy.', { spontaneity: 1, novelty: 1 }],
    ['💡 Finally understanding something', 'Understanding. The moment the map makes sense.', { curiosity: 2 }],
    ['🎁 Surprising someone else', 'Surprising someone. You walk for other people.', { social: 1, support_cheer: 1 }],
  ], 'That’s what fuel looks like for you.'),
  seed('overnight-skill', 'Excellent by tomorrow', 'You could be excellent at one thing by tomorrow. Which kind?', [
    ['🎨 Something creative', 'Creative. The world needs more made things.', { making: 2 }],
    ['🧠 Something clever', 'Clever. You’d like the map to be legible.', { curiosity: 2 }],
    ['🏃 Something physical', 'Physical. I’ll race you.', { ambition: 1, resilience: 1 }],
    ['💬 Something social', 'Social. Rooms would get easier.', { social: 2 }],
    ['🔧 Something practical', 'Practical. Useful hands.', { planning: 2 }],
  ], 'Nobody’s excellent overnight. Walking helps with all five.'),
  seed('four-doors', 'Four doors', 'Four doors on the trail. Which sign pulls you in?', [
    ['🌲 “Somewhere you’ve never been”', 'Never been. Of course.', { novelty: 2 }],
    ['🕯️ “Something you’ve forgotten”', 'Forgotten. Careful, that door’s heavy.', { curiosity: 1 }],
    ['⭐ “Something you could become”', 'Could become. Ambitious. Good.', { ambition: 2 }],
    ['🏡 “Somewhere you feel completely safe”', 'Completely safe. Everyone needs that door.', { rest: 1, caution: 1 }],
  ], 'I’d take the first one, then the last one. In that order.'),
  seed('dangerous-sentence', 'The dangerous sentence', 'Which sentence is most dangerous for you, personally?', [
    ['🌅 “I’ll start tomorrow.”', 'Tomorrow. It’s a very convincing word.', { avoidance: 2 }],
    ['💎 “It has to be perfect.”', 'Perfect. The trail is never perfect and it’s still good.', { overthinking: 2 }],
    ['🧱 “I can handle everything myself.”', 'Handling it alone. You don’t have to.', { solitude: 2 }],
    ['🫣 “I don’t want to disappoint anyone.”', 'Disappointing people. You carry more than your pack.', { social: 1, caution: 1 }],
  ], 'Knowing your dangerous sentence is half of ignoring it.', 2),
  seed('keep-full', 'One thing, always full', 'You can keep one thing permanently full. Which?', [
    ['🔋 My energy', 'Energy. Enough for one more hill.', { resilience: 1, ambition: 1 }],
    ['🧠 My curiosity', 'Curiosity. Never runs out anyway, but nice.', { curiosity: 2 }],
    ['❤️ My confidence', 'Confidence. Boots on, no wobble.', { optimism: 2 }],
    ['⏳ My free time', 'Free time. The rarest one.', { rest: 2 }],
  ], 'I’d take energy. Then spend it on free time.'),
  seed('circled-map', 'One place circled', 'Someone hands you a map with one place circled and no explanation.', [
    ['🏃 I go', 'You go. I’m already lacing up.', { spontaneity: 2 }],
    ['🔎 I look into it first', 'Look first. Maps can lie.', { caution: 1, curiosity: 1 }],
    ['👥 I bring someone', 'Bring someone. Circles are better shared.', { social: 2 }],
    ['📬 I wait for more information', 'Wait. Sensible, and a little bit killing me.', { caution: 2 }],
  ], 'It’s circled for a reason. We should find out.'),
  seed('good-week', 'A really good week', 'At the end of a really good week, what probably happened?', [
    ['✨ I got something done', 'Got something done. Your good weeks have a shape.', { ambition: 2 }],
    ['❤️ I spent time with people I like', 'People. Your good weeks have company.', { social: 2 }],
    ['🌿 I actually felt calm', 'Calm. Your good weeks have air in them.', { rest: 2 }],
    ['🗺️ Something unexpected happened', 'Unexpected. Your good weeks have a twist.', { novelty: 2 }],
    ['🎨 I made or found something inspiring', 'Something inspiring. Your good weeks have a spark.', { making: 2 }],
  ], 'That’s your definition of a good week. Not mine. Yours. Kept.'),
  seed('mind-room', 'If your head were a room', 'If your head were a room right now, what would it look like?', [
    ['🧹 Neat and quiet', 'Neat and quiet. Rare. Enjoy it.', { rest: 2 }],
    ['📚 Busy but organised', 'Busy but organised. A good desk.', { planning: 2 }],
    ['🧦 Stuff everywhere, but I know where things are', 'Stuff everywhere, all findable. My kind of room.', { making: 1, spontaneity: 1 }],
    ['🌪️ Something definitely happened in here', 'Something happened. A walk would help. It usually does.', { overthinking: 1 }],
  ], 'Rooms change. Ask me again tomorrow.'),
  // A second set: the same shape, more of life. Plus four forced choices, which are quick and very revealing.
  seed('afternoon-back', 'An afternoon back', 'You suddenly get a whole afternoon back. What happens to it?', [
    ['🌿 Go somewhere peaceful', 'Somewhere peaceful. I know a bench.', { rest: 2 }],
    ['✅ Finally do that thing', 'The thing. It has been waiting. Good.', { ambition: 1, planning: 1 }],
    ['🎨 Do something I enjoy', 'Something you enjoy. That is what afternoons are for.', { making: 2 }],
    ['🛋️ Absolutely nothing', 'Nothing. Properly. I respect it.', { rest: 2 }],
  ], 'Afternoons are rare. I’ve written down what you do with one.'),
  seed('worst-bit', 'The worst bit', 'Which bit of doing something difficult is usually worst?', [
    ['🌱 Starting', 'Starting. The trailhead is the hardest step.', { avoidance: 2 }],
    ['🔁 Keeping it going', 'Keeping going. Mile three, every time.', { routine: 1, resilience: 1 }],
    ['🏁 Finishing', 'Finishing. The last stretch always looks longer.', { overthinking: 1 }],
    ['🧠 Deciding what to do', 'Deciding. Too many paths. I know that fork.', { overthinking: 1, curiosity: 1 }],
  ], 'Good to know which bit. I’ll walk that bit with you.'),
  seed('one-weed', 'One weed', 'There’s one weed in an otherwise beautiful garden. What do you notice first?', [
    ['🌸 The garden', 'The garden. The weed is furious.', { optimism: 2 }],
    ['👀 The weed', 'The weed. Weeds count on that.', { overthinking: 2 }],
    ['🧤 I immediately fix it', 'Straight in with the gloves. Efficient.', { planning: 1, resilience: 1 }],
    ['😌 It can wait', 'It can wait. So can you. Sit down.', { rest: 1, avoidance: 1 }],
  ], 'I’d have seen the garden. I’d have tripped on the weed.'),
  seed('new-idea', 'A new idea', 'You have a new idea you’re excited about. What happens next?', [
    ['⚡ Start immediately', 'Straight in. Plans can catch up.', { spontaneity: 2 }],
    ['📋 Make a plan', 'A plan. The idea will thank you.', { planning: 2 }],
    ['💭 Think about it for ages', 'Thinking for ages. A slow, quiet kind of starting.', { overthinking: 2 }],
    ['😅 Get another idea', 'Another idea. Two trailheads, one pair of boots.', { curiosity: 1, spontaneity: 1 }],
  ], 'Ideas are trailheads. You’ve told me which kind you take.'),
  seed('plan-falls-apart', 'The plan falls apart', 'A plan falls apart at the last minute. You…', [
    ['🔧 Make another plan', 'Another plan. Always another route.', { resilience: 2, planning: 1 }],
    ['🌊 See what happens instead', 'See what happens. Days have their own ideas.', { spontaneity: 2, optimism: 1 }],
    ['😤 Need time to be annoyed', 'Annoyed first. Honest. Then what?', { overthinking: 1, resilience: 1 }],
    ['🏠 Would rather call it a day', 'Call it a day. Sometimes the right route is home.', { rest: 1, avoidance: 1 }],
  ], 'Fallen plans find out who you are. Noted, kindly.'),
  seed('more-satisfying', 'More satisfying', 'What sounds more satisfying?', [
    ['🏆 Finishing something big', 'Finishing something big. Summit.', { ambition: 2 }],
    ['🌱 Tiny progress every day', 'Tiny progress, daily. The long walk.', { routine: 2, resilience: 1 }],
    ['✨ Starting something exciting', 'Starting something exciting. Trailhead.', { spontaneity: 1, novelty: 1 }],
    ['🍃 Finally taking something off my plate', 'Something off the plate. Lighter pack.', { rest: 2 }],
  ], 'That’s what fuel looks like for you.'),
  seed('six-months', 'Six months to get good', 'Someone tells you something will take six months to get good at.', [
    ['🌱 Fine by me', 'Fine by you. Patience is a kind of fitness.', { routine: 2, resilience: 1 }],
    ['🔥 Challenge accepted', 'Challenge accepted. I’ll hold the stopwatch.', { ambition: 2 }],
    ['😬 Six months?!', 'Six months. I know. Trails are long.', { spontaneity: 1, avoidance: 1 }],
    ['🤔 Depends how much I care', 'Depends if you care. Fair. Not every hill.', { caution: 1 }],
  ], 'Six months is a lot of walks. We could do it in walks.'),
  seed('trouble-sentence', 'The troublesome sentence', 'Which sentence causes you the most trouble?', [
    ['⏳ “Tomorrow.”', 'Tomorrow. A very convincing word.', { avoidance: 2 }],
    ['✨ “It needs to be perfect.”', 'Perfect. The trail never is, and it’s still good.', { overthinking: 2 }],
    ['🔥 “I can do all of it.”', 'All of it. Even I pack one bag.', { ambition: 2 }],
    ['❤️ “I don’t want to disappoint them.”', 'Disappointing people. You carry more than your pack.', { social: 1, caution: 1 }],
  ], 'Knowing the sentence is half of ignoring it.', 2),
  seed('brain-garden', 'Your brain, as a garden', 'If your brain were a garden today, what are we dealing with?', [
    ['🌳 Calm and tidy', 'Calm and tidy. Rare. Enjoy it.', { rest: 2 }],
    ['🌿 Busy but growing', 'Busy but growing. A good working garden.', { making: 1, planning: 1 }],
    ['🍂 Needs some attention', 'Needs some attention. A walk counts as attention.', { overthinking: 1, rest: 1 }],
    ['🌪️ Someone released goats in here', 'Goats. I’ll bring a gate. And snacks for the goats.', { overthinking: 2 }],
  ], 'Gardens change. Ask me again tomorrow.'),
  seed('disappears-first', 'What goes first', 'When life gets busy, what disappears first?', [
    ['😴 Sleep', 'Sleep. The roots go first and nobody sees it.', { rest: 1 }],
    ['🚶 Movement', 'Movement. The path grows over fast. I’d know.', { routine: 1 }],
    ['🎨 Things I enjoy', 'The things you enjoy. The flowers, not the vegetables.', { making: 1 }],
    ['🌿 Time alone', 'Time alone. The quiet corner gets built on.', { solitude: 1, rest: 1 }],
    ['👥 Seeing people', 'Seeing people. The gate stays shut.', { social: 1 }],
  ], 'I’ll watch for that one going, and say so.'),
  seed('get-moving', 'What gets you moving', 'You’ve been putting something off. What would actually get you moving?', [
    ['🌱 Make it tiny', 'Make it tiny. One step. Then the next.', { planning: 1, resilience: 1 }],
    ['⏰ Give me a deadline', 'A deadline. Weather does the same for walks.', { planning: 2 }],
    ['👥 Someone checks on me', 'Someone checking in. I can check in. I have a bell.', { social: 2 }],
    ['🔥 Enough pressure eventually', 'Pressure, eventually. It works. It isn’t restful.', { avoidance: 1, spontaneity: 1 }],
  ], 'Filed under how to help without nagging.'),
  seed('went-badly', 'It went badly', 'You tried something and it went badly.', [
    ['🔧 Try differently', 'Try differently. Another route.', { resilience: 2 }],
    ['💭 Figure out why', 'Figure out why. Useful, as long as it ends.', { curiosity: 1, overthinking: 1 }],
    ['😤 Be annoyed first', 'Annoyed first. Honest. Then what?', { overthinking: 1, resilience: 1 }],
    ['🚪 Maybe it wasn’t for me', 'Maybe not for you. Quick, at least.', { caution: 1, avoidance: 1 }],
  ], 'That’s your first move after a fall. I’ll offer the second.'),
  seed('secret-compliment', 'The secret compliment', 'Which compliment would secretly mean the most?', [
    ['❤️ You’re kind', 'Kind. That’s the one you keep.', { support_stay: 1, social: 1 }],
    ['🧠 You’re capable', 'Capable. You like the work to show.', { ambition: 2 }],
    ['🌱 You’ve grown', 'Grown. My favourite one, obviously.', { resilience: 1, optimism: 1 }],
    ['✨ You’re different', 'Different. A path, not a road.', { novelty: 2 }],
    ['😂 You’re fun', 'Fun. You want people to leave lighter.', { social: 2 }],
  ], 'I’ll find a moment to say it.'),
  seed('friend-terrible-day', 'A friend’s terrible day', 'A friend has a terrible day. Your instinct?', [
    ['💬 Listen', 'Listen. You’re a good place to put things down.', { support_listen: 2 }],
    ['🛠️ Solve it', 'Solve it. Practical love.', { support_fix: 2 }],
    ['😂 Distract them', 'Distract them. You bring the weather with you.', { support_cheer: 2 }],
    ['🫶 Just be there', 'Just be there. Sometimes that’s the whole job.', { support_stay: 2 }],
  ], 'Noted. Now the other way round.'),
  seed('your-terrible-day', 'Your terrible day', 'And when you have a terrible day?', [
    ['💬 Let me talk', 'Talk. I have ears and no schedule.', { support_listen: 2 }],
    ['🛠️ Help me solve it', 'Solve it. I can carry a map.', { support_fix: 2 }],
    ['😂 Distract me', 'Distraction. I know a duck with opinions.', { support_cheer: 2 }],
    ['🍃 Give me space', 'Space. I can be nearby and quiet. Mostly.', { solitude: 2 }],
  ], 'I’ll remember that for the next terrible day.'),
  seed('know-or-find-out', 'Know, or find out', 'Would you rather know exactly where a path leads, or find out as you go?', [
    ['🗺️ Know first', 'Know first. Maps are comforting.', { caution: 2, planning: 1 }],
    ['🌲 Discover as I go', 'Find out as you go. Same.', { novelty: 2, spontaneity: 1 }],
    ['🤏 A little of both', 'A little of both. Enough to feel safe, not enough to spoil it.', { curiosity: 2 }],
  ], 'That’s how you like your paths. I’ll pick accordingly.'),
  seed('day-worthwhile', 'A worthwhile day', 'What makes a day feel worthwhile?', [
    ['✅ I achieved something', 'Achieved something. A full row.', { ambition: 2 }],
    ['🌿 I felt good', 'Felt good. A good day in any weather.', { rest: 2 }],
    ['❤️ I connected with someone', 'Connected with someone. The gate was open.', { social: 2 }],
    ['✨ Something memorable happened', 'Something memorable. A story for the walk home.', { novelty: 2 }],
    ['🎨 I made or discovered something', 'Made or found something. A seed you didn’t plant.', { making: 2 }],
  ], 'That’s your definition. Not mine. Yours. Kept.'),
  seed('ruins-momentum', 'What ruins momentum', 'You finally have momentum. What usually ruins it?', [
    ['📱 Distraction', 'Distraction. The path has a lot of side paths.', { novelty: 1, avoidance: 1 }],
    ['🔥 Taking on too much', 'Too much. Even I pack one bag.', { ambition: 2 }],
    ['😴 Running out of energy', 'Energy. The tank, not the will.', { rest: 2 }],
    ['🧠 Overthinking', 'Overthinking. The map gets bigger than the walk.', { overthinking: 2 }],
    ['🤷 Nothing in particular', 'Nothing in particular. Momentum just wanders off. It does that.', { spontaneity: 1 }],
  ], 'Now I know what to watch for once you’re moving.'),
  seed('magical-gift', 'A magical gift', 'Which magical gift would you choose?', [
    ['🔋 Endless energy', 'Endless energy. Enough for every hill.', { rest: 1, ambition: 1 }],
    ['⏳ More time', 'More time. The rarest one.', { rest: 2 }],
    ['🎯 Perfect focus', 'Perfect focus. One bed at a time.', { planning: 2 }],
    ['❤️ Unshakeable confidence', 'Unshakeable confidence. Boots on, no wobble.', { optimism: 2 }],
    ['🍃 A quieter mind', 'A quieter mind. A walk is the closest I’ve found.', { overthinking: 2 }],
  ], 'No magic here. Walking helps with all five, a bit.'),
  seed('stop-caring', 'Halfway and stopped caring', 'You’re halfway through something and stop caring. What now?', [
    ['🔥 Finish anyway', 'Finish anyway. Stubborn. Good.', { ambition: 1, resilience: 1 }],
    ['🌱 Shrink the goal', 'Shrink the goal. Very sensible.', { planning: 1, resilience: 1 }],
    ['🍃 Take a break', 'A break, then back. The trail keeps.', { rest: 2 }],
    ['👻 Quietly abandon ship', 'Abandon ship, quietly. We all have a ghost project.', { avoidance: 2 }],
  ], 'Now I know what halfway looks like for you.'),
  seed('offered-help', 'Someone offers help', 'Someone offers to help with something you’re struggling with.', [
    ['🙏 Yes please', 'Yes please. Easy. Good.', { social: 2 }],
    ['🤝 Only with part of it', 'Part of it. Reasonable terms.', { social: 1, caution: 1 }],
    ['😅 I’ll probably say I’m fine', 'You’ll say you’re fine. I know that one.', { solitude: 2 }],
    ['🧠 Depends if they’ll do it my way', 'Only your way. Fair. Also, noted.', { solitude: 1, planning: 1 }],
  ], 'Helping is a two-way path. You’ve told me which way you walk it.'),
  seed('future-excites', 'The future thing', 'What kind of future thing gets you most excited?', [
    ['🌱 Becoming better at something', 'Getting better at something. The long walk.', { ambition: 1, routine: 1 }],
    ['🗺️ Going somewhere new', 'Somewhere new. Obviously. Same.', { novelty: 2 }],
    ['🏡 Building something stable', 'Something stable. A cabin at the end of the trail.', { routine: 2 }],
    ['🎨 Making something', 'Making something. A thing that wasn’t there before.', { making: 2 }],
    ['❤️ Sharing life with people', 'Sharing it. Company on the path.', { social: 2 }],
  ], 'That’s the direction you’re walking. Good to know.'),
  seed('remind-you', 'What to remind you of', 'Which would a friend have to remind you of most?', [
    ['🌿 Take a break', 'Take a break. I’ll say it. Often.', { ambition: 1, rest: 1 }],
    ['🌱 Just start', 'Just start. I’ll say it at the trailhead.', { avoidance: 2 }],
    ['🧠 Stop overthinking', 'Stop overthinking. I’ll say it and then we’ll walk.', { overthinking: 2 }],
    ['🏁 Finish the thing', 'Finish the thing. I’ll say it near the end.', { spontaneity: 1, avoidance: 1 }],
    ['❤️ Be nicer to yourself', 'Be nicer to yourself. I’ll say it most of all.', { overthinking: 1, rest: 1 }],
  ], 'I’ll remind you. Gently. Usually.'),
  seed('too-many-ideas', 'Too many, or not enough', 'More dangerous: having too many ideas, or not enough?', [
    ['💡 Too many', 'Too many. The fork with nine paths.', { curiosity: 1, spontaneity: 1 }],
    ['🌫️ Not enough', 'Not enough. A blank map.', { routine: 1, caution: 1 }],
  ], 'Fast one. Revealing one.'),
  seed('consistency-intensity', 'Consistency or intensity', 'Better: consistency, or intensity?', [
    ['🔁 Consistency', 'Consistency. The daily loop.', { routine: 2 }],
    ['🔥 Intensity', 'Intensity. The big climb.', { ambition: 2 }],
  ], 'Both get you up the hill. Differently.'),
  seed('old-or-new', 'Improve or start', 'Would you rather improve something old, or start something new?', [
    ['🌿 Improve something old', 'Improve the old thing. Tend it.', { routine: 2 }],
    ['✨ Start something new', 'Start something new. A bare trailhead.', { novelty: 2 }],
  ], 'Cultivation or discovery. Both are walking.'),
  seed('regret', 'What you regret', 'Do you regret things you did more, or things you didn’t do?', [
    ['💥 Things I did', 'Things you did. Loud ones, probably.', { caution: 2 }],
    ['🚪 Things I didn’t do', 'Things you didn’t. The doors you walked past.', { spontaneity: 1, ambition: 1 }],
  ], 'That’s your risk compass. I’ll keep it in my pack.'),
];
