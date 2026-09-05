import type { AuthoredCompanionContentSeed } from '@/constants/steppling-companion-content';

type Option = readonly [id: string, label: string];
type Pack = {
  pulses: readonly AuthoredCompanionContentSeed[];
  reviews: readonly AuthoredCompanionContentSeed[];
  returns: readonly AuthoredCompanionContentSeed[];
  bonds: Readonly<Record<2 | 3 | 4, AuthoredCompanionContentSeed>>;
};

function item(
  title: string,
  prompt: string,
  helperText: string,
  options: readonly Option[],
): AuthoredCompanionContentSeed {
  return { title, prompt, helperText, options: options.map(([id, label]) => ({ id, label })) };
}

const rest: Pack = {
  pulses: [
    item('Name the need', 'What kind of rest did you need most today?', 'Rest can mean sleep, quiet, comfort, or fewer demands.', [['sleep', 'More sleep'], ['quiet', 'A quiet pause'], ['lower-demands', 'Fewer demands'], ['comfort', 'Comfort and ease'], ['unsure', 'I am not sure']]),
    item('Notice what helped', 'Did anything help you feel more restored today?', 'Choose what came closest. It is also useful to notice when nothing helped enough.', [['sleep', 'Sleep or lying down'], ['quiet', 'Time without demands'], ['activity', 'A gentle activity'], ['support', 'Comfort or support'], ['nothing', 'Nothing helped enough']]),
    item('Find the stopping point', 'When was it hardest to stop today?', 'This is about the demands around you, not your willpower.', [['work', 'Work or study'], ['chores', 'Chores and practical tasks'], ['caring', 'Caring for someone'], ['screens', 'Scrolling or watching'], ['not-hard', 'Stopping was not hard today']]),
    item('Read the signals', 'What first suggested that you needed rest?', 'You may have noticed a body signal, a change in attention, or nothing clear.', [['low-energy', 'My energy dropped'], ['tension', 'My body felt tense or heavy'], ['attention', 'It was harder to concentrate'], ['emotions', 'My emotions felt closer to the surface'], ['no-signal', 'There was no clear signal']]),
    item('Let the day finish', 'What helped the day feel finished?', 'A small stopping cue can count, even if sleep came later.', [['boundary', 'I stopped work or chores'], ['ritual', 'I followed a familiar ritual'], ['tomorrow', 'I prepared one thing for tomorrow'], ['company', 'I spent quiet time with someone'], ['nothing', 'Nothing marked the ending']]),
    item('Make room for rest', 'What made rest more possible today?', 'Look at the conditions around rest, rather than whether you did it perfectly.', [['time', 'I protected some time'], ['expectations', 'I lowered an expectation'], ['place', 'I had a comfortable place'], ['help', 'Someone else helped'], ['chance', 'A gap appeared by chance']]),
    item('Look back gently', 'What was sleep like last night?', 'This is a simple check-in, not a sleep score.', [['restorative', 'Mostly restorative'], ['interrupted', 'Interrupted'], ['settling', 'Hard to settle into'], ['short', 'Shorter than I needed'], ['unsure', 'Hard to tell']]),
    item('Notice the evening pace', 'How did the pace of your evening feel?', 'Choose the overall shape, even if different parts felt different.', [['gentle', 'Mostly gentle'], ['rushed', 'Rushed'], ['stretched', 'It went on too long'], ['mixed', 'Mixed'], ['no-pause', 'There was no real evening pause']]),
    item('Choose recovery', 'What kind of recovery would suit tomorrow?', 'Choose a kind option, not another target to achieve.', [['short-quiet', 'A short quiet pause'], ['less', 'Fewer demands'], ['comfort', 'Something comforting'], ['earlier-stop', 'An earlier stopping point'], ['no-plan', 'No plan for now']]),
    item('Notice a boundary', 'Which boundary has helped your rest most recently?', 'A boundary can be small, temporary, or supported by someone else.', [['work', 'A stopping time for work'], ['screens', 'A break from screens'], ['availability', 'Being less available'], ['chores', 'Letting a chore wait'], ['none', 'No clear boundary yet']]),
    item('Learn what restores', 'What are you learning about real rest?', 'Rest does not need to look the same every day.', [['quiet', 'Quiet helps'], ['comfort', 'Comfort helps'], ['connection', 'Safe company helps'], ['gentle-activity', 'Gentle activity helps'], ['varies', 'What helps varies']]),
    item('Make rest kinder', 'What would make this Rest Focus kinder to live with?', 'Changing or pausing the Focus is valid information, not failure.', [['smaller', 'Make it smaller'], ['flexible', 'Make it more flexible'], ['timing', 'Try another time'], ['support', 'Ask for support'], ['pause', 'Pause it for now']]),
  ],
  reviews: [
    item('See what restores', 'Across recent days, what has restored you most reliably?', 'Choose the closest pattern. There may not be a clear one yet.', [['sleep', 'Enough sleep'], ['quiet', 'Quiet time'], ['less', 'Doing less'], ['comfort', 'Comfort or support'], ['unclear', 'Nothing is clear yet']]),
    item('Notice what changed', 'What has changed since you chose this Rest Focus?', 'A clearer need or barrier counts, even if rest has not increased.', [['more-rest', 'I make more room for rest'], ['stop-easier', 'Stopping feels easier'], ['signals', 'I notice my signals sooner'], ['barriers', 'I understand the barriers better'], ['no-change', 'Nothing has clearly changed']]),
    item('Make the Focus fit', 'What would make your Rest Focus more realistic now?', 'You can reduce, reshape, or pause it.', [['smaller', 'A smaller aim'], ['flexible', 'More flexibility'], ['different-rest', 'A different kind of rest'], ['support', 'More practical support'], ['pause', 'A pause for now']]),
    item('Choose what continues', 'What would you most like to carry into the next week?', 'Keep one supportive condition; you do not need a perfect routine.', [['stopping', 'A clearer stopping point'], ['quiet', 'A quiet pause'], ['comfort', 'A comforting ritual'], ['lower-demands', 'Lower expectations'], ['permission', 'Permission to adapt']]),
  ],
  returns: [
    item('Does rest still fit?', 'Does your current Rest Focus still fit your life?', 'Needs and responsibilities change. An earlier choice does not have to stay fixed.', [['fits', 'It still fits'], ['adjust', 'I want to adjust it'], ['pause', 'I want to pause it'], ['complete', 'It feels complete'], ['unsure', 'I am not sure']]),
    item('Check what you need', 'Do you still need the same kind of rest?', 'Choose what is true now, rather than what you hoped would be true.', [['same', 'Yes, much the same'], ['partly', 'Partly'], ['different', 'I need something different'], ['less-needed', 'It feels less urgent now'], ['unsure', 'I am not sure']]),
    item('Check the barrier', 'Is the same thing still limiting rest?', 'The answer may be a changing schedule, responsibilities, or no clear pattern.', [['same', 'Yes, much the same'], ['different', 'Something different limits it'], ['easier', 'Rest is easier to make room for'], ['varies', 'It varies'], ['unclear', 'There is no clear pattern']]),
    item('Choose what happens next', 'What would you like to do with this Rest Focus now?', 'Continuing, changing, pausing, and finishing are all valid.', [['continue', 'Continue as it is'], ['reshape', 'Change the Focus'], ['pause', 'Pause it'], ['complete', 'Mark it complete'], ['later', 'Decide another day']]),
  ],
  bonds: {
    2: item('You know each other better', 'How would you like your companion to support your rest?', 'This shapes future invitations. It is not another demand.', [['signals', 'Help me notice signals'], ['protect', 'Support my boundaries'], ['gentle', 'Offer gentle options'], ['permission', 'Remind me rest is allowed']]),
    3: item('A pattern between you', 'What have you learned about what restores you?', 'Choose the clearest lesson so far, including that it varies.', [['sleep', 'Sleep matters most'], ['quiet', 'Quiet matters most'], ['comfort', 'Comfort matters most'], ['boundaries', 'Boundaries matter most'], ['varies', 'It changes from day to day']]),
    4: item('A shared history', 'What should your companion carry forward about rest?', 'Choose what you want future conversations to protect.', [['permission', 'Permission to rest'], ['signals', 'The signals I notice'], ['ritual', 'A ritual that helps'], ['boundary', 'A boundary that matters'], ['kindness', 'A gentler expectation']]),
  },
};

const tasklet: Pack = {
  pulses: [
    item('Check the priority', 'What happened with your main priority today?', 'Choosing, changing, pausing, and finishing can all be useful outcomes.', [['moved', 'It moved forward'], ['clearer', 'It became clearer'], ['changed', 'The priority changed'], ['paused', 'I chose to pause it'], ['no-movement', 'Nothing moved today']]),
    item('Make starting easier', 'What made starting easier today?', 'Notice a condition you could use again, if one was present.', [['step', 'The next step was clear'], ['time', 'I had protected time'], ['ready', 'What I needed was ready'], ['support', 'Someone helped'], ['nothing', 'Nothing made it easier']]),
    item('Locate the friction', 'Where did friction show up?', 'Friction is information. It is not a judgement about your effort.', [['unclear', 'The task was unclear'], ['time', 'There was not enough time'], ['energy', 'My energy was limited'], ['interruptions', 'Other things kept interrupting'], ['too-large', 'The task felt too large']]),
    item('Name the progress', 'What kind of progress happened today?', 'Progress can be a decision or a useful ending, not only more output.', [['decided', 'I made a decision'], ['started', 'I started'], ['continued', 'I continued'], ['finished', 'I finished something'], ['let-go', 'I let something go']]),
    item('Reduce the load', 'What deserves less attention now?', 'You can choose something that can wait, change hands, or leave the list.', [['low-value', 'Something low-value'], ['not-needed', 'Something no longer needed'], ['delegate', 'Something another person can do'], ['wait', 'Something that can wait'], ['unsure', 'I am not sure yet']]),
    item('Clarify the next step', 'What made the next step clearer?', 'A question, experiment, or request for help can create clarity.', [['smaller', 'I broke it down'], ['information', 'I found new information'], ['asked', 'I asked for help'], ['tried', 'I tried something'], ['unclear', 'It is still unclear']]),
    item('Match the energy', 'How well did today’s effort fit your available energy?', 'Stopping can be the right response to limited capacity.', [['fit', 'It fitted well'], ['smaller', 'I needed a smaller task'], ['pushed', 'I pushed too far'], ['stopped', 'I stopped when I needed to'], ['varied', 'It varied']]),
    item('Leave a return point', 'What would help you return to the work?', 'Choose one useful marker, not a plan for the whole project.', [['action', 'A named next action'], ['question', 'A question to answer'], ['decision', 'A decision to make'], ['prepare', 'Something set up in advance'], ['rest', 'Returning after rest']]),
    item('Notice working conditions', 'Which condition supported your attention today?', 'Conditions often matter more than trying harder.', [['quiet', 'A quieter space'], ['timer', 'A short time limit'], ['place', 'A particular place'], ['company', 'Working alongside someone'], ['flexibility', 'Freedom to change course']]),
    item('Let the task change', 'What changed about the task today?', 'A changed task may need a changed plan.', [['scope', 'Its size or scope'], ['priority', 'Its priority'], ['timing', 'Its timing'], ['meaning', 'Why it matters'], ['no-change', 'Nothing changed']]),
    item('Keep what worked', 'What is most worth using again?', 'Keep one support rather than turning the whole day into a rule.', [['next-step', 'A clear next step'], ['time', 'Protected time'], ['boundary', 'A stopping boundary'], ['simplify', 'A simpler version'], ['delegate', 'Sharing the load']]),
    item('Make progress kinder', 'What would make this Focus easier to live with?', 'Changing the plan is part of working sustainably.', [['smaller', 'Make it smaller'], ['flexible', 'Make it more flexible'], ['drop', 'Drop a task'], ['support', 'Ask for support'], ['pause', 'Pause it for now']]),
  ],
  reviews: [
    item('See what moves work', 'Across recent days, what has helped useful work move?', 'This is a review of conditions, not a productivity score.', [['clear-step', 'A clear next step'], ['protected-time', 'Protected time'], ['smaller-scope', 'A smaller scope'], ['support', 'Help or accountability'], ['unclear', 'Nothing is clear yet']]),
    item('Notice what changed', 'What has changed since you chose this Focus?', 'Clearer priorities and knowing what to stop both count.', [['more-movement', 'More has moved forward'], ['easier-start', 'Starting feels easier'], ['clearer', 'The work is clearer'], ['stopped', 'I know what not to do'], ['no-change', 'Nothing has clearly changed']]),
    item('Make the Focus fit', 'What would make this work Focus more realistic now?', 'Reduce or change the work before asking more of yourself.', [['smaller', 'A smaller outcome'], ['fewer', 'Fewer active tasks'], ['different-time', 'A different time'], ['support', 'More support'], ['pause', 'A pause for now']]),
    item('Choose what continues', 'What would you most like to carry into the next week?', 'Choose one working condition or decision.', [['next-action', 'A clear next action'], ['priority', 'One protected priority'], ['boundary', 'A stopping boundary'], ['simpler', 'A simpler approach'], ['rest', 'More room for rest']]),
  ],
  returns: [
    item('Does the work still matter?', 'Does your current Tasklet Focus still fit?', 'A project can change, finish, or stop being worth the effort.', [['fits', 'It still fits'], ['adjust', 'It needs adjusting'], ['pause', 'I want to pause it'], ['complete', 'It is complete'], ['drop', 'I want to let it go']]),
    item('Check the outcome', 'Are you still working towards the same useful outcome?', 'Name the direction, not how much you have produced.', [['same', 'Yes, the same outcome'], ['partly', 'Partly'], ['changed', 'The outcome has changed'], ['unclear', 'It is unclear now']]),
    item('Check the conditions', 'Is the same thing still making the work difficult?', 'The work may have changed, or your available capacity may be different.', [['same', 'Yes, much the same'], ['different', 'A different issue'], ['easier', 'The conditions are better'], ['varies', 'It varies'], ['not-work', 'This work no longer fits']]),
    item('Choose what happens next', 'What should happen with this Focus now?', 'Continuing is only one valid answer.', [['continue', 'Continue as it is'], ['reshape', 'Reshape it'], ['delegate', 'Share or delegate it'], ['pause', 'Pause it'], ['finish', 'Close this chapter']]),
  ],
  bonds: {
    2: item('You know each other better', 'How would you like Tasklet to support your work?', 'Choose a style of support, not a level of pressure.', [['clarify', 'Help me clarify one step'], ['prioritise', 'Help me choose what matters'], ['small', 'Keep suggestions small'], ['stop', 'Help me notice when to stop']]),
    3: item('A pattern between you', 'What have you learned about how you work best?', 'Choose the condition that has become clearest.', [['clarity', 'I need clarity'], ['time', 'I need protected time'], ['small', 'Smaller steps help'], ['support', 'Support helps'], ['capacity', 'My capacity changes']]),
    4: item('A shared history', 'What should Tasklet carry into future projects?', 'Keep the lesson that supports sustainable progress.', [['conditions', 'The conditions that help'], ['priority', 'How I choose priorities'], ['limits', 'My limits and boundaries'], ['course-change', 'Permission to change course'], ['finished', 'What I have completed']]),
  },
};

const mossprout: Pack = {
  pulses: [
    item('Find nearby nature', 'What kind of nature moment was available today?', 'A view through a window, a plant, weather, or no moment all count.', [['outside', 'An outdoor place'], ['window', 'A view from indoors'], ['plant', 'A cared-for plant'], ['animal-weather', 'An animal or the weather'], ['none', 'No nature moment today']]),
    item('Keep one detail', 'What living or seasonal detail did you notice?', 'Choose the kind of detail, even if the moment was brief.', [['plant', 'A plant or tree'], ['animal', 'An animal or insect'], ['light-weather', 'Light or weather'], ['sound-texture', 'A sound or texture'], ['none', 'No clear detail']]),
    item('Notice where it appears', 'Where was nature easiest to notice?', 'Nearby and indoor moments count just as much as a trip outdoors.', [['route', 'Along an everyday route'], ['window', 'From a window'], ['green-place', 'In a green place'], ['plant', 'With a plant nearby'], ['unexpected', 'Somewhere unexpected']]),
    item('Notice the pace', 'How did the nature moment affect your pace?', 'There does not need to have been a calming effect.', [['slower', 'I slowed down'], ['energy', 'I felt more alert'], ['attention', 'My attention shifted'], ['mixed', 'It felt mixed'], ['no-change', 'I noticed no change']]),
    item('Respect access', 'What made nature harder to reach or notice today?', 'Access can change with weather, safety, time, mobility, and energy.', [['time', 'Not enough time'], ['weather', 'Weather or darkness'], ['safety', 'The surroundings did not feel safe'], ['mobility', 'Mobility or energy'], ['no-moment', 'Nothing nearby caught my attention']]),
    item('Read the season', 'Which sign of the season was clearest?', 'Small changes in light, temperature, growth, and animals count.', [['light', 'The light'], ['temperature', 'The temperature'], ['growth', 'Growth or decay'], ['animals', 'Animal activity'], ['none', 'No clear sign']]),
    item('Choose what is accessible', 'What nature moment would suit your next few days?', 'Choose what is close and realistic now.', [['window', 'Looking from a window'], ['plant', 'Checking a plant'], ['brief-outside', 'A brief moment outside'], ['familiar-place', 'A familiar green place'], ['none', 'No plan for now']]),
    item('Return and compare', 'What changed in a familiar place or view?', 'The answer can be a small change or no visible change.', [['colour', 'Colour'], ['light', 'Light or weather'], ['living', 'Plants or animals'], ['people', 'How people used the place'], ['no-change', 'Nothing I could see']]),
    item('Follow attention', 'What drew your attention first?', 'Notice the sensory doorway rather than searching for an impressive sight.', [['movement', 'Movement'], ['colour', 'Colour'], ['sound', 'Sound'], ['pattern', 'A shape or pattern'], ['change', 'Something that had changed']]),
    item('Care without pressure', 'What was plant care like today?', 'Checking and deciding no action was needed can count as care.', [['watered', 'I watered something'], ['tended', 'I pruned or tidied'], ['checked', 'I checked what it needed'], ['adapted', 'I changed its position or care'], ['none', 'There was no plant-care moment']]),
    item('Choose a return place', 'What makes a nearby place or view worth returning to?', 'Familiarity can matter more than variety.', [['easy', 'It is easy to reach'], ['comfortable', 'It feels comfortable'], ['details', 'There is detail to notice'], ['changes', 'It changes over time'], ['familiar', 'It feels familiar']]),
    item('Make nature accessible', 'What would make this nature Focus easier to live with?', 'The Focus can move closer, indoors, or pause.', [['closer', 'Keep it closer to home'], ['shorter', 'Make moments shorter'], ['indoors', 'Include indoor views or plants'], ['weather', 'Keep it weather-flexible'], ['pause', 'Pause it for now']]),
  ],
  reviews: [
    item('See what draws you back', 'Across recent nature moments, what has held your attention most?', 'Choose the kind of detail you naturally noticed.', [['plants', 'Plants and trees'], ['animals', 'Animals and insects'], ['weather', 'Weather and light'], ['places', 'Changes in a familiar place'], ['unclear', 'Nothing is clear yet']]),
    item('Notice what changed', 'What has changed since you chose this nature Focus?', 'More access is not the only change; attention and knowledge count too.', [['notice-more', 'I notice more detail'], ['return', 'I return more often'], ['season', 'I see seasonal change'], ['access', 'I understand what is accessible'], ['no-change', 'Nothing has clearly changed']]),
    item('Make the Focus fit', 'What would make nearby nature more realistic now?', 'Adapt the setting, duration, or frequency to your circumstances.', [['closer', 'A closer place or view'], ['shorter', 'Shorter moments'], ['indoors', 'More indoor options'], ['less-often', 'Less often'], ['pause', 'A pause for now']]),
    item('Choose what continues', 'What would you most like to keep noticing?', 'Choose one thread to carry forward.', [['season', 'Seasonal change'], ['familiar', 'A familiar place'], ['living', 'Living details'], ['sensory', 'Sounds, textures, or light'], ['care', 'Caring for a plant']]),
  ],
  returns: [
    item('Does this still fit?', 'Does your current Mossprout Focus still fit your life?', 'Access and seasons change, so the Focus may need to change too.', [['fits', 'It still fits'], ['adjust', 'I want to adjust it'], ['indoors', 'I need an indoor version'], ['pause', 'I want to pause it'], ['complete', 'It feels complete']]),
    item('Check what draws you', 'Do you still want the same thing from nearby nature?', 'Your interest may move from going somewhere to noticing or caring.', [['same', 'Yes, the same thing'], ['notice', 'I want to notice more'], ['return', 'I want to return somewhere'], ['care', 'I want to care for something'], ['unsure', 'I am not sure']]),
    item('Check access', 'Is the same thing still limiting nature moments?', 'Choose what is true in your life now.', [['same', 'Yes, much the same'], ['different', 'Something different limits access'], ['easier', 'Access is easier now'], ['varies', 'It varies'], ['no-barrier', 'There is no clear barrier']]),
    item('Choose what happens next', 'What would you like to do with this nature Focus?', 'Continuing, adapting, pausing, and finishing are all valid.', [['continue', 'Continue as it is'], ['adapt', 'Change how or where'], ['new-thread', 'Follow a different detail'], ['pause', 'Pause it'], ['complete', 'Mark it complete']]),
  ],
  bonds: {
    2: item('You know each other better', 'How would you like Mossprout to support your nature moments?', 'Choose support that respects access, weather, and energy.', [['nearby', 'Keep ideas close by'], ['sensory', 'Prompt one sensory detail'], ['patterns', 'Help me notice changes'], ['flexible', 'Keep every idea flexible']]),
    3: item('A pattern between you', 'What have you learned about how you notice nature?', 'Choose the clearest pattern from nearby moments.', [['plants', 'Plants catch my attention'], ['animals', 'Animals catch my attention'], ['weather', 'Weather and light stand out'], ['returning', 'Returning helps me notice'], ['varies', 'It changes each time']]),
    4: item('A shared history', 'What should Mossprout carry forward?', 'Choose what you want future invitations to remember.', [['place', 'A familiar place or view'], ['season', 'The season changing'], ['care', 'Something I cared for'], ['access', 'What is accessible to me'], ['curiosity', 'The habit of small noticing']]),
  },
};

const gatherglow: Pack = {
  pulses: [
    item('Notice connection', 'What shape did connection take today?', 'Contact can be active, received, quiet, or absent.', [['reached', 'I reached out'], ['received', 'Someone reached out to me'], ['shared', 'We shared time or attention'], ['quiet', 'I had quiet company'], ['none', 'There was no contact']]),
    item('Respect social energy', 'What was your social energy like today?', 'Wanting space can be as useful to notice as wanting contact.', [['enough', 'I had enough for connection'], ['limited', 'It was limited'], ['changed', 'It changed through the day'], ['solitude', 'I needed solitude'], ['unsure', 'I am not sure']]),
    item('Find what felt genuine', 'What helped a connection feel genuine?', 'Choose the quality of the moment, without naming another person.', [['attention', 'Full attention'], ['honesty', 'Honesty'], ['ease', 'Ease'], ['laughter', 'Shared humour'], ['care', 'Practical care']]),
    item('Notice the boundary', 'Where did a social boundary matter today?', 'A boundary can protect connection as well as solitude.', [['time', 'How long I stayed'], ['topic', 'What I discussed'], ['availability', 'When I was available'], ['space', 'Choosing space'], ['none', 'No boundary stood out']]),
    item('Read the outreach', 'What happened with outreach today?', 'A reply is not under your control, and choosing not to reach out can be wise.', [['connected', 'We connected'], ['later', 'A reply may come later'], ['no-reply', 'There was no reply'], ['chose-not', 'I chose not to reach out'], ['not-needed', 'Outreach was not needed']]),
    item('Notice reciprocity', 'What made a connection feel mutual?', 'Look for shared effort or respected limits.', [['initiated', 'We both initiated'], ['listened', 'We both listened'], ['effort', 'We shared the effort'], ['limits', 'My limits were respected'], ['not-mutual', 'It did not feel mutual']]),
    item('Choose the right amount', 'What kind of connection would suit your next few days?', 'More contact is not always the right answer.', [['message', 'A simple message'], ['call', 'A call or conversation'], ['activity', 'A shared activity'], ['quiet', 'Quiet company'], ['space', 'More space for myself']]),
    item('Be present safely', 'What helped you be present with someone?', 'Feeling safe and having enough energy are valid conditions.', [['time', 'Enough time'], ['attention', 'Fewer distractions'], ['activity', 'Doing something together'], ['safe', 'Feeling safe and at ease'], ['energy', 'Having enough energy']]),
    item('Name what was difficult', 'What made connection harder today?', 'The difficulty may belong to timing or circumstances, not either person.', [['timing', 'Timing'], ['energy', 'Limited energy'], ['anxiety', 'Anxiety or uncertainty'], ['tension', 'Tension or disagreement'], ['access', 'Distance or access']]),
    item('Notice belonging', 'Where, if anywhere, did you feel a sense of belonging?', 'A small one-to-one moment can count; no such moment is also valid.', [['group', 'In a group'], ['one', 'With one person'], ['place', 'In a familiar place'], ['purpose', 'Through a shared purpose'], ['none', 'I did not feel it today']]),
    item('Tend what is mutual', 'What quality makes a connection worth tending?', 'Choose a quality, not a particular person.', [['ease', 'Ease'], ['mutual', 'Mutual effort'], ['honesty', 'Honesty'], ['support', 'Support'], ['joy', 'Enjoyment']]),
    item('Make connection kinder', 'What would make this Connection Focus kinder to live with?', 'You can choose less contact, clearer boundaries, or a pause.', [['less-often', 'Make it less frequent'], ['smaller', 'Keep outreach smaller'], ['boundaries', 'Use clearer boundaries'], ['different', 'Choose a different connection'], ['pause', 'Pause it for now']]),
  ],
  reviews: [
    item('See what supports connection', 'Across recent days, what has helped connection feel worthwhile?', 'This is about quality and fit, not the number of interactions.', [['attention', 'Shared attention'], ['mutual', 'Mutual effort'], ['ease', 'Ease and humour'], ['boundaries', 'Respected boundaries'], ['unclear', 'Nothing is clear yet']]),
    item('Notice what changed', 'What has changed since you chose this Connection Focus?', 'A better boundary or clearer preference counts as change.', [['contact', 'Contact is more regular'], ['genuine', 'Connection feels more genuine'], ['belonging', 'I feel more belonging'], ['boundaries', 'My boundaries are clearer'], ['no-change', 'Nothing has clearly changed']]),
    item('Make the Focus fit', 'What would make this Connection Focus more realistic now?', 'Keep the part that is within your control.', [['smaller', 'Smaller outreach'], ['less-often', 'Less frequent contact'], ['different-shape', 'A different kind of connection'], ['boundaries', 'Stronger boundaries'], ['pause', 'A pause for now']]),
    item('Choose what continues', 'What would you most like to carry into the next week?', 'Choose one quality or action, not an obligation to be social.', [['reply', 'Replying when I have capacity'], ['attention', 'Giving full attention'], ['plan', 'One simple shared plan'], ['appreciation', 'Expressing appreciation'], ['space', 'Protecting needed solitude']]),
  ],
  returns: [
    item('Does this still fit?', 'Does your current Connection Focus still fit your life?', 'Relationships and social energy change. The Focus can change with them.', [['fits', 'It still fits'], ['adjust', 'I want to adjust it'], ['space', 'I need more space'], ['pause', 'I want to pause it'], ['complete', 'It feels complete']]),
    item('Check what you want', 'Do you still want the same kind of connection?', 'Choose the shape you want now, without naming another person.', [['same', 'Yes, the same kind'], ['quieter', 'Something quieter'], ['deeper', 'Something deeper'], ['broader', 'A wider sense of belonging'], ['unsure', 'I am not sure']]),
    item('Check the difficulty', 'Is the same thing still making connection difficult?', 'Limited energy, an unanswered message, or a changed relationship can all alter the pattern.', [['same', 'Yes, much the same'], ['different', 'Something different'], ['easier', 'Connection feels easier'], ['varies', 'It varies'], ['unsafe', 'This connection no longer feels right']]),
    item('Choose what happens next', 'What would you like to do with this Connection Focus?', 'You control your own action and boundaries, not another person’s response.', [['continue', 'Continue as it is'], ['reshape', 'Reshape it'], ['different', 'Choose a different connection'], ['pause', 'Pause it'], ['complete', 'Mark it complete']]),
  ],
  bonds: {
    2: item('You know each other better', 'How would you like Gatherglow to support connection?', 'Choose support that respects your energy and boundaries.', [['small', 'Suggest small ways to connect'], ['patterns', 'Help me notice reciprocity'], ['boundaries', 'Support my boundaries'], ['space', 'Respect when I need space']]),
    3: item('A pattern between you', 'What have you learned about connection that suits you?', 'Choose the quality that has become clearest.', [['attention', 'Shared attention matters'], ['mutual', 'Mutual effort matters'], ['ease', 'Ease matters'], ['boundaries', 'Boundaries matter'], ['energy', 'My social energy changes']]),
    4: item('A shared history', 'What should Gatherglow carry forward?', 'Choose what future invitations should protect or encourage.', [['people', 'Connections that feel mutual'], ['quality', 'The quality I value'], ['boundaries', 'My boundaries'], ['belonging', 'Where I feel belonging'], ['solitude', 'My need for solitude']]),
  },
};

export const BATCH_ONE_COMPANION_CONTENT: Readonly<Record<string, Pack>> = {
  'sleep-rest': rest,
  tasklet,
  mossprout,
  gatherglow,
};
