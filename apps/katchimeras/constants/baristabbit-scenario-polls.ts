import type { ConversationPollSeed, ConversationTraitTags } from '@/types/companion-conversation';

/**
 * Baristabbit's daily questions: one tiny scene each, answered in a tap, then
 * the village's fictional poll. Nobody is asked how organised they are. Each
 * answer quietly tags a trait or two (`traits`), which is how the player
 * learns something about themselves almost by accident.
 *
 * Voice: Baristabbit is calm, dry and warm, always somewhere near a kettle.
 * Replies are one or two short lines and never grade the answer. Present
 * tense, one image a line, no exclamation marks.
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

export const BARISTABBIT_SCENARIO_POLLS: readonly ConversationPollSeed[] = [
  seed('first-cup', 'The first cup', 'The kettle clicks off and the day has not started yet. What is the first cup for?', [
    ['☀️ Waking up, slowly', 'Slowly is allowed. The day waits.', { rest: 2 }],
    ['📋 Lining up the day', 'A plan with a cup in it. Sensible.', { planning: 2 }],
    ['🤫 Ten minutes that are mine', 'Yours. I will not tell anyone.', { solitude: 2 }],
    ['🚪 Getting out the door', 'Cup in hand, door already open. I know the type.', { spontaneity: 1, ambition: 1 }],
  ], 'The first cup says a lot. I have written it down.'),
  seed('cafe-table', 'One free table', 'A café has one free table, by the window, next to a stranger. What do you do?', [
    ['🪑 Take it and say hello', 'Hello costs nothing and sometimes buys a story.', { social: 2 }],
    ['📖 Take it and open a book', 'A book is a polite wall. I approve.', { solitude: 2 }],
    ['🚶 Take the drink to go', 'To go. The pause comes with you.', { spontaneity: 1, solitude: 1 }],
    ['⏳ Wait for another table', 'Waiting for the right table. Patient, or particular.', { caution: 1, planning: 1 }],
  ], 'The village argued about the window seat for a while.'),
  seed('usual-order', 'The usual', 'The menu has your usual and one thing you have never tried. Which do you order?', [
    ['☕ The usual, obviously', 'The usual is the usual for a reason.', { routine: 2 }],
    ['✨ The new thing', 'Straight for the new thing. Report back.', { novelty: 2, curiosity: 1 }],
    ['🤔 I ask what the new thing is first', 'Ask first. Then decide. A good habit.', { curiosity: 1, caution: 1 }],
    ['🎲 Whatever the person in front ordered', 'Let the queue decide. A small adventure.', { spontaneity: 2 }],
  ], 'Half the village never changes their order. The other half never repeats one.'),
  seed('spilled-cup', 'The spilled cup', 'You knock the cup over the moment it is full. First feeling?', [
    ['😮‍💨 Fine. I make another', 'Another one. The kettle is still warm.', { resilience: 2 }],
    ['🙃 Of course this happened', 'Of course. The day has a sense of humour.', { optimism: 1, resilience: 1 }],
    ['😩 That was the good cup', 'The good cup. I am sorry for your loss.', { overthinking: 1 }],
    ['🧽 Clean first, feel later', 'Cloth first, feelings second. Efficient.', { planning: 1, resilience: 1 }],
  ], 'Everyone spills. What comes after is the interesting part.'),
  seed('rainy-window', 'Rain on the window', 'Rain starts while you are holding a warm cup. What happens next?', [
    ['🌧️ I stay and watch it', 'The best kind of nothing. Stay.', { rest: 2 }],
    ['🧥 I finish up and go out in it', 'Out into it. Some people are made of weather.', { spontaneity: 2 }],
    ['📓 I write something down', 'Rain and a pen. It happens to a lot of people.', { making: 2 }],
    ['📞 I call someone', 'Rain makes calls longer. Good.', { social: 2 }],
  ], 'The rain got a surprisingly warm reception from the village.'),
  seed('too-many-mugs', 'Too many mugs', 'The cupboard is full of mugs and you only use two. What do you do?', [
    ['🎁 Give the rest away', 'Give them away. Someone is short a mug.', { support_fix: 1, planning: 1 }],
    ['🧺 Keep them. Each has a story', 'Each mug a story. I would keep them too.', { routine: 1, rest: 1 }],
    ['🔄 Start using a different one each day', 'A mug rota. Small novelty, daily.', { novelty: 2 }],
    ['🤷 Nothing. It is a cupboard', 'A cupboard is allowed to be full. Fair.', { avoidance: 1, rest: 1 }],
  ], 'The village is divided on mugs. Deeply.'),
  seed('quiet-morning', 'A quiet morning', 'Nobody needs anything from you until noon. How does the morning go?', [
    ['🛏️ Slowly, from bed', 'From bed, with a cup within reach. Correct.', { rest: 2 }],
    ['🏃 I get everything done before anyone wakes', 'Done before the world is up. Quietly impressive.', { ambition: 2, planning: 1 }],
    ['🎨 I make something', 'A morning that makes something. Keep those.', { making: 2 }],
    ['🌳 I go out while it is still quiet', 'Out while it is quiet. The town is yours.', { spontaneity: 1, solitude: 1 }],
  ], 'A free morning is a kind of test. You passed, whatever you picked.'),
  seed('kettle-wait', 'While the kettle boils', 'The kettle takes a minute. What do you do with the minute?', [
    ['📱 Check my phone', 'A minute of phone. The kettle does not mind.', { avoidance: 1, routine: 1 }],
    ['🪟 Look out of the window', 'Window watching. An old and honourable use of a minute.', { rest: 2 }],
    ['🧹 Tidy one thing', 'One thing tidied per kettle. It adds up.', { planning: 1, making: 1 }],
    ['🧍 Stand there and wait', 'Just waiting. Hard to do. Respect.', { rest: 1, resilience: 1 }],
  ], 'A minute is longer than people think.'),
  seed('cold-tea', 'The forgotten cup', 'You find a cup you made an hour ago, cold. What happened in that hour?', [
    ['🔥 I got absorbed in something', 'Absorbed. The tea understands.', { making: 2 }],
    ['📞 Someone needed me', 'Someone needed you and you went. The tea can wait.', { support_stay: 2 }],
    ['💭 I was thinking', 'Thinking for an hour. It cools tea and warms ideas.', { overthinking: 1, curiosity: 1 }],
    ['🌀 I honestly do not know', 'An hour vanished. It happens to the best kettles.', { spontaneity: 1, avoidance: 1 }],
  ], 'Cold cups are evidence. I keep a small file.'),
  seed('friend-flat', 'A friend, flat', 'A friend turns up looking flat. What do you put in front of them?', [
    ['🍵 A drink and no questions', 'A cup and silence. You can sit in that.', { support_stay: 2 }],
    ['👂 A drink and one question', 'One good question. Then listen.', { support_listen: 2 }],
    ['💡 A drink and a plan', 'A plan with the cup. Some people need the plan.', { support_fix: 2 }],
    ['😄 A drink and something silly', 'Silly works more often than people admit.', { support_cheer: 2 }],
  ], 'Everyone has a way of sitting with someone. I noted yours.'),
  seed('wrong-drink', 'The wrong drink', 'The café hands you the wrong drink. What do you do?', [
    ['🙋 Say so, politely', 'Politely, and it gets fixed. Simple.', { resilience: 1, support_fix: 1 }],
    ['🤐 Drink it anyway', 'Drink it anyway. A quiet adventure.', { avoidance: 1, novelty: 1 }],
    ['😊 Maybe it is better', 'Maybe it is better. Optimists get good drinks.', { optimism: 2 }],
    ['😤 It ruins the whole pause', 'The whole pause, ruined. I have days like that too.', { overthinking: 2 }],
  ], 'The wrong drink is a small test of character. Nobody fails it.'),
  seed('new-cafe', 'A new place', 'A new café opens on your street. When do you go in?', [
    ['🎉 Opening day', 'Opening day. First in the door.', { novelty: 2, spontaneity: 1 }],
    ['👀 After I have heard what it is like', 'After the reviews. Sensible.', { caution: 2 }],
    ['🗓️ When I have a reason', 'When there is a reason. Reasons come.', { planning: 1, routine: 1 }],
    ['🏠 I have my place already', 'You have a place. Loyalty is a kind of comfort.', { routine: 2 }],
  ], 'New places divide the village into scouts and regulars.'),
  seed('one-more', 'One more cup', 'It is late and there is time for one more cup. Do you?', [
    ['☕ Yes. Tonight is long', 'Tonight is long. Pour it.', { spontaneity: 1, ambition: 1 }],
    ['🌙 No. Tomorrow needs me', 'Tomorrow needs you. Kettle off.', { planning: 2 }],
    ['🍵 Something without caffeine', 'The gentle option. Warm, no consequences.', { caution: 1, rest: 1 }],
    ['🤷 I never remember to decide', 'Undecided until it is decided for you. Common.', { avoidance: 1 }],
  ], 'The late cup is a whole personality. I have met several.'),
  seed('empty-cafe', 'The empty café', 'You walk into a café and it is completely empty. How does that feel?', [
    ['😌 Perfect', 'Perfect. The whole room is a pause.', { solitude: 2 }],
    ['😬 A bit lonely', 'A bit lonely. You like a room with a hum.', { social: 2 }],
    ['🤨 Suspicious. Why is it empty', 'Why is it empty. A fair question.', { caution: 2 }],
    ['🎭 Like I own the place', 'Owner of an empty café. Live it.', { optimism: 1, spontaneity: 1 }],
  ], 'Empty rooms are loud for some people and quiet for others.'),
  seed('lost-recipe', 'The lost recipe', 'You cannot remember how you made yesterday’s perfect cup. What do you do?', [
    ['🧪 Try until I get it back', 'Experiment until it returns. It will.', { resilience: 2, curiosity: 1 }],
    ['📝 Write it down next time', 'Next time, a note. The future you says thanks.', { planning: 2 }],
    ['🤷 Make a different perfect cup', 'A different perfect cup. There are many.', { optimism: 1, novelty: 1 }],
    ['😔 Mourn it briefly', 'A brief mourning. Then tea.', { overthinking: 1 }],
  ], 'Perfect cups are rarely repeated. That is what makes them perfect.'),
  seed('shared-pot', 'The shared pot', 'Someone makes a pot for the whole table. What do you do?', [
    ['🫖 Pour for everyone', 'Pour for the table. Someone has to.', { support_fix: 1, social: 1 }],
    ['😊 Say thank you and wait', 'Thank you, and wait. Manners are a warm thing.', { support_listen: 1, routine: 1 }],
    ['🥤 Quietly order my own', 'Your own cup, quietly. Independence is fine.', { solitude: 2 }],
    ['🎉 Make a toast', 'A toast with tea. Bold and correct.', { support_cheer: 2 }],
  ], 'A shared pot sorts a table into pourers and waiters.'),
  seed('early-close', 'Closing early', 'The café is closing early and your drink is half finished. What now?', [
    ['🚶 Take it with me', 'Take it. The walk is part of the drink.', { spontaneity: 1, resilience: 1 }],
    ['⏱️ Finish fast', 'Fast finish. The pause compresses.', { ambition: 1, planning: 1 }],
    ['🙂 Leave it. It was enough', 'Enough is enough. A rare skill.', { rest: 2 }],
    ['😑 Sit until they ask me to go', 'Sit until asked. A quiet protest.', { avoidance: 1, resilience: 1 }],
  ], 'Half a drink is still a drink. The village mostly agreed.'),
  seed('gift-mug', 'A gift mug', 'Someone gives you a mug that is not to your taste. What happens to it?', [
    ['🥰 It becomes my mug anyway', 'It becomes the mug. Because of who gave it.', { support_stay: 1, routine: 1 }],
    ['🎁 It goes on to someone else', 'Passed on to someone who loves it. Kind.', { support_fix: 1, planning: 1 }],
    ['🌱 It grows a plant', 'A plant lives in it now. Everyone wins.', { making: 2 }],
    ['🗄️ Back of the cupboard', 'Back of the cupboard, with the others.', { avoidance: 1 }],
  ], 'Every cupboard has a gift mug. Yours has a story now.'),
  seed('queue', 'The long queue', 'The queue for the good place is long. What do you do?', [
    ['🧍 Wait. It is worth it', 'Worth the wait. Standing is a pause too.', { resilience: 1, routine: 1 }],
    ['🔀 Go somewhere with no queue', 'No queue. Different cup, same pause.', { spontaneity: 1, novelty: 1 }],
    ['💬 Chat to whoever is behind me', 'The queue becomes company. Nice trick.', { social: 2 }],
    ['🏠 Make one at home', 'Home. The queue is one person long.', { solitude: 1, planning: 1 }],
  ], 'Queues tell you what people will wait for.'),
  seed('bad-day-cup', 'After a bad day', 'A rough day is over. What is in the cup tonight?', [
    ['🍫 Something sweet and warm', 'Sweet and warm. The oldest medicine.', { rest: 2 }],
    ['🍵 The same as always', 'The same as always. Routine holds the day up.', { routine: 2 }],
    ['🥂 Something a bit special', 'Something special. The day owes you that.', { optimism: 1, novelty: 1 }],
    ['💧 Just water, and bed', 'Water and bed. The bravest option.', { rest: 1, caution: 1 }],
  ], 'Rough days end in cups. The village compared notes.'),
  seed('surprise-visit', 'A surprise visit', 'Someone knocks unexpectedly, mid-pause. What do you do?', [
    ['🚪 Kettle on, door open', 'Kettle on. The pause grows a chair.', { social: 2 }],
    ['⏸️ Ask if we can do it later', 'Later, kindly. Your pause is yours.', { solitude: 2 }],
    ['😅 Tidy for thirty seconds first', 'Thirty seconds of tidying. Everyone does it.', { caution: 1, planning: 1 }],
    ['🤫 Pretend I am out', 'Pretend to be out. I will not judge.', { avoidance: 2 }],
  ], 'A knock during a pause is a small plot twist.'),
  seed('menu-board', 'The menu board', 'The menu board is enormous and the barista is waiting. What do you do?', [
    ['⚡ Order the first thing I see', 'The first thing. Decisive, or panicked.', { spontaneity: 2 }],
    ['🙏 Ask for a recommendation', 'A recommendation. Let the expert carry it.', { support_listen: 1, curiosity: 1 }],
    ['📖 Read the whole thing', 'The whole board. The queue can breathe.', { planning: 1, overthinking: 1 }],
    ['☕ The usual, even here', 'The usual, wherever you are. A portable home.', { routine: 2 }],
  ], 'Big menus separate readers from pointers.'),
  seed('window-seat', 'The window seat', 'You get the window seat. What do you watch?', [
    ['👥 The people', 'People. Every one a story you do not have to finish.', { social: 1, curiosity: 1 }],
    ['🌥️ The weather', 'The weather. Slower than people, more honest.', { rest: 2 }],
    ['🐕 The dogs', 'The dogs. Correct answer, quietly.', { optimism: 2 }],
    ['📓 Nothing. I am writing', 'You are writing and the window is a lamp.', { making: 2 }],
  ], 'Window seats are for watching. What you watch is the tell.'),
  seed('last-of-it', 'The last of it', 'There is one serving of your favourite left. Who gets it?', [
    ['🙋 Me. It is mine', 'Yours. Fair is fair.', { solitude: 1, ambition: 1 }],
    ['🤝 Whoever asks first', 'First to ask. Democratic.', { social: 1, support_listen: 1 }],
    ['🎁 Someone who needs it more', 'Given away. That is a whole way of living.', { support_stay: 2 }],
    ['✂️ Split it', 'Split it. Two small pauses.', { support_fix: 1, planning: 1 }],
  ], 'The last serving is a small ethics exam. Everyone passed.'),
  seed('early-riser', 'Before everyone', 'You are up before everyone else. What is the first sound?', [
    ['🫖 The kettle', 'The kettle. My favourite sound.', { routine: 2 }],
    ['🐦 Birds, through the window', 'Birds. You listened before you did anything.', { rest: 2 }],
    ['🎵 Something playing quietly', 'Quiet music. The day gets a soundtrack.', { making: 1, optimism: 1 }],
    ['⌨️ Me, already working', 'Already working. The kettle catches up later.', { ambition: 2 }],
  ], 'First sounds are honest. I keep them.'),
  seed('café-mistake', 'Their mistake', 'The café charges you for two drinks. You only had one. What do you do?', [
    ['🙂 Point it out, kindly', 'Kindly, and it is sorted.', { support_fix: 1, resilience: 1 }],
    ['🤷 Let it go', 'Let it go. Peace is worth a coffee.', { rest: 1, avoidance: 1 }],
    ['🎁 Call it a tip', 'A tip. Generous, or tired.', { optimism: 1, social: 1 }],
    ['😤 Say so, firmly', 'Firmly. Someone has to keep the till honest.', { resilience: 2 }],
  ], 'Small mistakes show what people do with small power.'),
  seed('long-pause', 'A long pause', 'You have a whole afternoon and a pot of something warm. How does it go?', [
    ['📚 It disappears into a book', 'A book and a pot. The afternoon was never seen again.', { solitude: 1, rest: 1 }],
    ['👥 I invite someone over', 'Company, and a bigger pot.', { social: 2 }],
    ['🧶 I make something with my hands', 'Hands busy, mind quiet. A good afternoon.', { making: 2 }],
    ['😴 I fall asleep halfway', 'Asleep with a warm cup nearby. The dream.', { rest: 2 }],
  ], 'Long pauses reveal what people do when nothing is asked of them.'),
  seed('cup-for-later', 'The cup for later', 'You make a cup and something urgent comes up. What happens to the cup?', [
    ['🔥 It waits. I come back', 'You come back. The cup knew you would.', { planning: 1, routine: 1 }],
    ['🥶 It goes cold and I forget', 'Cold and forgotten. A common ending.', { avoidance: 1, spontaneity: 1 }],
    ['🚶 It comes with me', 'It comes with you. A travelling pause.', { resilience: 1, ambition: 1 }],
    ['💧 I pour it out and start again later', 'Poured out, started again. Clean slate.', { planning: 2 }],
  ], 'The abandoned cup is the most common cup. No shame.'),
  seed('quiet-company', 'Quiet company', 'A friend sits with you and neither of you says much. How is that?', [
    ['😌 Perfect', 'Perfect. Silence with someone is a rare drink.', { support_stay: 2 }],
    ['😅 I fill the silence', 'You fill it. Somebody usually does.', { social: 2 }],
    ['🤔 I wonder what they are thinking', 'Wondering, quietly. A thoughtful kind of company.', { overthinking: 1, support_listen: 1 }],
    ['📱 We both look at our phones', 'Both phones. Also a kind of together.', { avoidance: 1, rest: 1 }],
  ], 'Quiet company is not for everyone. I noted where you sit.'),
  seed('dangerous-sentence', 'The dangerous sentence', 'Which sentence is most dangerous for you?', [
    ['☕ One more, then I start', '"One more, then I start." The kettle has heard that one.', { avoidance: 2 }],
    ['⚡ I can do all of it today', '"All of it, today." Bold. Tiring.', { ambition: 2 }],
    ['🤐 It is fine, I do not need help', '"I do not need help." Said by everyone who does, sometimes.', { solitude: 1, resilience: 1 }],
    ['🌀 I will decide later', '"Later." A word that hides a lot.', { avoidance: 1, overthinking: 1 }],
  ], 'A dangerous sentence is one you have said this week. I have too.', 2),
  seed('perfect-pause', 'The perfect pause', 'Design the perfect ten-minute pause. What is in it?', [
    ['🪟 A window and nothing else', 'A window. That is the whole recipe.', { rest: 2 }],
    ['🎧 One song, all the way through', 'One song, uninterrupted. Rarer than it sounds.', { making: 1, rest: 1 }],
    ['💬 A short call to someone good', 'A good voice for ten minutes. Yes.', { social: 2 }],
    ['🚶 A walk around the block', 'Round the block. The pause that moves.', { spontaneity: 1, resilience: 1 }],
  ], 'Ten minutes is enough. That was the whole point.'),
];
