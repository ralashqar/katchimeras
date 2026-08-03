import type { AuthoredCompanionContentSeed } from '@/constants/steppling-companion-content';

type Pack = {
  pulses: readonly AuthoredCompanionContentSeed[];
  reviews: readonly AuthoredCompanionContentSeed[];
  returns: readonly AuthoredCompanionContentSeed[];
  bonds: Readonly<Record<2 | 3 | 4, AuthoredCompanionContentSeed>>;
};

function q(title: string, prompt: string, helperText: string, options: string): AuthoredCompanionContentSeed {
  return {
    title,
    prompt,
    helperText,
    options: options.split('|').map((value) => {
      const separator = value.indexOf(':');
      return { id: value.slice(0, separator), label: value.slice(separator + 1) };
    }),
  };
}

const feastle: Pack = {
  pulses: [
    q('Notice the meal', 'What kind of food moment fitted today?', 'A meal, snack, drink, shared table, or very limited option can all count.', 'cooked:I made something|assembled:I put something simple together|bought:I bought or collected food|shared:I ate with someone|limited:My options were limited'),
    q('Name what mattered', 'What mattered most about one food moment today?', 'This is about your experience, not whether the food was “good” or “bad”.', 'ease:It was easy|comfort:It was comforting|taste:I enjoyed the taste|company:The company mattered|fuel:It met a practical need'),
    q('Read the conditions', 'What made eating or preparing food easier?', 'Notice practical support rather than judging effort.', 'time:I had enough time|ingredients:Food was available|simple:I kept it simple|help:Someone helped|nothing:Nothing made it easier'),
    q('Respect the limits', 'What made food more difficult today?', 'Cost, access, appetite, time, culture, and energy can all shape a meal.', 'time:Not enough time|cost:Cost or availability|energy:Limited energy|appetite:Appetite or sensory needs|other-needs:Other people’s needs'),
    q('Keep one flavour', 'What sensory detail stayed with you?', 'Choose what you genuinely noticed; it does not need to be unusual.', 'taste:A taste|texture:A texture|smell:A smell|temperature:Temperature|none:Nothing stood out'),
    q('Notice the pace', 'What was the pace of eating like?', 'There is no ideal pace. Choose what came closest.', 'unhurried:Unhurried|rushed:Rushed|interrupted:Interrupted|mixed:Mixed|unsure:I did not notice'),
    q('Choose what is realistic', 'What kind of food moment would suit the next few days?', 'Choose something possible with your time, budget, access, and energy.', 'simple:Something very simple|familiar:A familiar favourite|shared:A shared meal or snack|new:One small new flavour|no-plan:No plan for now'),
    q('Notice care', 'Where did care show up around food?', 'Care can mean feeding yourself, adapting a meal, or accepting help.', 'self:I fed myself|adapted:I adapted to a need|prepared:I made later easier|received:I accepted help|none:Care was hard to find'),
    q('Read satisfaction', 'How did one meal or snack meet the moment?', 'This is not a nutrition score; choose the role it played.', 'enough:It was enough for then|comfort:It brought comfort|interest:It brought interest|connection:It supported connection|not-enough:It did not meet what I needed'),
    q('Follow curiosity', 'What kind of food curiosity appeared?', 'Curiosity can be cultural, practical, sensory, or absent.', 'ingredient:An ingredient|method:A way of making something|story:A cultural or personal story|combination:A flavour combination|none:No food curiosity today'),
    q('Keep what works', 'What is most worth repeating from a recent food moment?', 'Keep one useful condition, not a rule for every meal.', 'simple:Keeping it simple|planning:A little preparation|company:Sharing it|attention:Giving it attention|flexibility:Adapting to the day'),
    q('Make it kinder', 'What would make this Food Focus kinder to live with?', 'You can reduce, adapt, or pause it without treating food as a test.', 'smaller:Make it smaller|cheaper:Make it lower-cost|easier:Use easier options|flexible:Make it more flexible|pause:Pause it for now'),
  ],
  reviews: [
    q('See what supports meals', 'Across recent food moments, what has helped most?', 'Review access, ease, enjoyment, and company—not dietary perfection.', 'simple:Simple options|prepared:A little preparation|available:Having food available|company:Company|unclear:Nothing is clear yet'),
    q('Notice what changed', 'What has changed since you chose this Food Focus?', 'A clearer need or easier option counts as change.', 'easier:Food feels easier to manage|more-care:I notice care more|more-interest:I feel more curious|know-limits:I understand the limits|no-change:Nothing has clearly changed'),
    q('Make the Focus fit', 'What would make your Food Focus more realistic now?', 'Choose an adjustment that respects access and capacity.', 'simpler:Simpler actions|less-often:Less often|lower-cost:Lower-cost options|support:More help|pause:A pause for now'),
    q('Choose what continues', 'What would you most like to carry into the next week?', 'Keep one useful thread rather than a perfect meal plan.', 'easy-meal:One easy meal|shared:One shared moment|curiosity:One food curiosity|preparation:A little preparation|flexibility:Permission to adapt'),
  ],
  returns: [
    q('Does this still fit?', 'Does your current Food Focus still fit your life?', 'Needs, access, appetite, and routines change.', 'fits:It still fits|adjust:I want to adjust it|pause:I want to pause it|complete:It feels complete|unsure:I am not sure'),
    q('Check what you want', 'Do you still want the same thing from food moments?', 'The direction can move between ease, enjoyment, curiosity, and connection.', 'same:Yes, the same thing|ease:I want more ease|enjoyment:I want more enjoyment|connection:I want more connection|unsure:I am not sure'),
    q('Check the barrier', 'Is the same thing still making food difficult?', 'Choose what is true now without blaming yourself.', 'same:Yes, much the same|different:Something different|easier:It has become easier|varies:It varies|unclear:There is no clear pattern'),
    q('Choose what happens next', 'What would you like to do with this Food Focus?', 'Continuing, adapting, pausing, and finishing are all valid.', 'continue:Continue as it is|reshape:Reshape it|simplify:Make it simpler|pause:Pause it|complete:Mark it complete'),
  ],
  bonds: {
    2: q('You know each other better', 'How would you like Feastle to support food moments?', 'Choose support that avoids pressure and respects access.', 'simple:Keep ideas simple|curious:Offer gentle curiosity|practical:Notice practical supports|flexible:Let me adapt freely'),
    3: q('A pattern between you', 'What have you learned about food moments that suit you?', 'Choose the clearest pattern so far.', 'ease:Ease matters|comfort:Comfort matters|interest:Curiosity matters|company:Company matters|varies:My needs vary'),
    4: q('A shared history', 'What should Feastle carry forward?', 'Choose what future invitations should remember.', 'favourites:Familiar favourites|discoveries:New discoveries|people:Shared food moments|access:What is accessible|kindness:A non-judgemental approach'),
  },
};

const coffeeRitual: Pack = {
  pulses: [
    q('Notice the pause', 'What kind of drink pause fitted today?', 'Coffee, tea, water, or another drink can hold the ritual. Skipping it also counts.', 'morning:A morning drink|workday:A workday pause|shared:A shared drink|evening:A later ritual|none:No drink pause today'),
    q('Name its purpose', 'What did one drink pause give you?', 'Choose the role of the pause, not the contents of the cup.', 'beginning:A clear beginning|break:A real break|comfort:Comfort|company:Company|nothing:No clear effect'),
    q('Make it possible', 'What helped the pause feel deliberate?', 'A small cue or a little time can be enough.', 'time:I gave it time|place:I used a familiar place|cup:A familiar object or cup|company:I shared it|nothing:Nothing made it deliberate'),
    q('Notice what crowded it', 'What made the pause harder to notice?', 'This is about the surrounding moment, not doing a ritual correctly.', 'rushed:I was rushed|screen:A screen took my attention|work:Work continued through it|interrupted:I was interrupted|no-pause:I did not take one'),
    q('Keep one sensory detail', 'What did you notice in the drink or moment?', 'Temperature, smell, taste, sound, and the feel of the pause all count.', 'temperature:Temperature|smell:Smell|taste:Taste|sound:The sounds around me|pace:The pace of the moment'),
    q('Read the pace', 'How did the drink pause feel?', 'Choose the overall pace, even if it was brief.', 'settled:Settled|rushed:Rushed|automatic:Automatic|shared:Social|mixed:Mixed'),
    q('Choose the next pause', 'What kind of ritual would suit the next few days?', 'The best option may be simple, caffeine-free, or no ritual at all.', 'first-sip:A quiet first sip|work-break:A short work break|shared:A shared drink|different:A different drink|none:No plan for now'),
    q('Notice the cue', 'What reminded you to pause?', 'Look for a cue you can recognise again.', 'time:A time of day|task-ending:Finishing something|body:A body signal|person:Another person|chance:It happened by chance'),
    q('Check the fit', 'How well did the drink itself fit what you needed?', 'This is not advice about caffeine; simply notice your own experience.', 'fitted:It fitted well|wanted-water:I wanted water instead|too-late:The timing did not suit me|habit:It was mostly habit|unsure:I am not sure'),
    q('Notice connection', 'What happened around a shared drink?', 'A brief exchange or choosing solitude can both be right.', 'conversation:We talked|quiet:We shared quiet|care:Someone showed care|solo:I chose time alone|none:There was no shared drink'),
    q('Keep what works', 'What is most worth repeating from this ritual?', 'Keep the helpful condition rather than prescribing a particular drink.', 'timing:The timing|place:The place|attention:Giving it attention|company:The company|flexibility:Keeping it flexible'),
    q('Make it kinder', 'What would make this Ritual Focus easier to live with?', 'Change the drink, timing, frequency, or pause the Focus.', 'shorter:Make it shorter|different-drink:Choose another drink|different-time:Try another time|less-often:Do it less often|pause:Pause it for now'),
  ],
  reviews: [
    q('See what makes a pause', 'Across recent drink rituals, what has made them feel worthwhile?', 'Review the pause itself, not how faithfully you repeated it.', 'attention:Giving it attention|timing:The right timing|comfort:Comfort|company:Company|unclear:Nothing is clear yet'),
    q('Notice what changed', 'What has changed since you chose this Ritual Focus?', 'A more deliberate pause or a clearer “not today” both count.', 'more-deliberate:Pauses feel more deliberate|more-restful:They feel more restful|more-social:They support connection|know-fit:I know what fits me|no-change:Nothing has clearly changed'),
    q('Make the Focus fit', 'What would make the ritual more realistic now?', 'Adapt it to your schedule, body, and preferences.', 'shorter:A shorter pause|different-drink:A different drink|different-time:A different time|less-often:Less often|pause:A pause for now'),
    q('Choose what continues', 'What would you most like to carry into the next week?', 'Keep one quality of the ritual.', 'beginning:A deliberate beginning|break:A real break|comfort:A comforting detail|company:A shared pause|choice:Choosing rather than drifting'),
  ],
  returns: [
    q('Does this still fit?', 'Does your current Drink Ritual Focus still fit?', 'Routines, preferences, and schedules change.', 'fits:It still fits|adjust:I want to adjust it|pause:I want to pause it|complete:It feels complete|unsure:I am not sure'),
    q('Check the purpose', 'Do you still want the same thing from the ritual?', 'The purpose may shift between beginning, pausing, comfort, and company.', 'same:Yes, the same thing|beginning:I want a clearer beginning|break:I want a better break|comfort:I want comfort|connection:I want connection'),
    q('Check the barrier', 'Is the same thing still making the pause difficult?', 'Timing and attention may change from day to day.', 'same:Yes, much the same|different:Something different|easier:It feels easier|varies:It varies|none:There is no clear barrier'),
    q('Choose what happens next', 'What would you like to do with this Ritual Focus?', 'Continue, change, pause, or finish it.', 'continue:Continue as it is|reshape:Change the ritual|change-drink:Change the drink|pause:Pause it|complete:Mark it complete'),
  ],
  bonds: {
    2: q('You know each other better', 'How would you like your ritual companion to support you?', 'The support is for the pause, not for consuming a particular drink.', 'cues:Help me notice cues|small:Keep ideas small|sensory:Invite sensory attention|flexible:Keep it flexible'),
    3: q('A pattern between you', 'What have you learned about pauses that work for you?', 'Choose the clearest pattern.', 'timing:Timing matters|attention:Attention matters|comfort:Comfort matters|company:Company matters|varies:It varies'),
    4: q('A shared history', 'What should your ritual companion carry forward?', 'Choose what future pauses should protect.', 'beginning:A meaningful beginning|break:A real break|objects:Familiar ritual details|people:Shared moments|choice:The freedom to choose'),
  },
};

const errandimp: Pack = {
  pulses: [
    q('Read the practical load', 'What kind of practical task was present today?', 'Completing, preparing, postponing, or having no capacity are all useful answers.', 'errand:An errand|admin:Life admin|home:A household task|appointment:An appointment or booking|none:No practical task moved'),
    q('Name the movement', 'What happened with one practical loose end?', 'Movement can mean deciding, delegating, or deliberately waiting.', 'finished:I finished it|started:I started it|planned:I made it clearer|delegated:I shared it|wait:I chose to let it wait'),
    q('Make it easier', 'What made a practical task easier?', 'Notice a condition that reduced effort.', 'route:It fitted an existing route|ready:I had what I needed|small:I kept it small|help:Someone helped|nothing:Nothing made it easier'),
    q('Respect the friction', 'What made practical tasks harder today?', 'Money, access, paperwork, time, and energy can all be real constraints.', 'time:Not enough time|energy:Limited energy|money:Cost|access:Access or opening times|unclear:I did not know what was needed'),
    q('Close a loop', 'What kind of loop did you close?', 'Choose the result, even if it took only a minute.', 'reply:A reply or message|booking:A booking|return:A return or collection|tidy:A useful reset|decision:A practical decision'),
    q('Notice the load', 'How did the practical load feel?', 'Choose the shape of it without judging yourself.', 'manageable:Manageable|scattered:Scattered|heavy:Heavy|shared:Shared with someone|unclear:Hard to assess'),
    q('Choose what fits', 'What practical action would suit the next few days?', 'Choose one action under your control.', 'one-errand:One small errand|five-minute:A five-minute reset|booking:One booking or form|prepare:Prepare something in advance|none:No new task for now'),
    q('Protect capacity', 'Where did stopping or postponing help?', 'Not every open loop needs closing today.', 'nonurgent:A non-urgent errand|chores:A household task|messages:A message or form|shopping:A purchase|none:I did not postpone anything'),
    q('Notice support', 'What kind of practical support mattered?', 'Support can be information, access, transport, money, or another person’s help.', 'information:Clear information|transport:Transport or location|money:Enough budget|person:Another person|tool:A reminder or list'),
    q('Prepare the return', 'What would make an unfinished task easier to return to?', 'Choose one marker rather than planning everything.', 'next-step:A written next step|materials:Things set out|time:A chosen time|help:A request for help|drop:Permission to drop it'),
    q('Keep what works', 'What is worth repeating from a recent practical win?', 'Keep one useful condition.', 'batch:Combining tasks|small:Keeping it small|early:Starting before urgency|help:Sharing the load|boundary:Stopping at enough'),
    q('Make it kinder', 'What would make this Practical Focus kinder?', 'Reduce, delegate, defer, or pause the Focus.', 'fewer:Fewer tasks|smaller:Smaller tasks|delegate:More shared load|more-time:More time|pause:Pause it for now'),
  ],
  reviews: [
    q('See what closes loops', 'Across recent practical tasks, what has helped most?', 'This is a review of conditions, not a measure of how organised you are.', 'small:Keeping tasks small|batch:Combining trips or tasks|prepare:Preparing ahead|help:Getting help|unclear:Nothing is clear yet'),
    q('Notice what changed', 'What has changed since you chose this Practical Focus?', 'Less mental load and clearer limits count too.', 'more-closed:More loops are closed|less-buildup:Less builds up|clearer:I know what matters|boundaries:I let things wait|no-change:Nothing has clearly changed'),
    q('Make the Focus fit', 'What would make the practical load more realistic now?', 'Choose an adjustment that respects capacity and resources.', 'fewer:Fewer active tasks|smaller:Smaller steps|delegate:More delegation|different-time:A different time|pause:A pause for now'),
    q('Choose what continues', 'What would you most like to carry into next week?', 'Keep one practical support.', 'one-loop:One loop at a time|reset:A brief reset|prepare:Preparing tomorrow|combine:Combining tasks|boundary:Letting non-urgent things wait'),
  ],
  returns: [
    q('Does this still fit?', 'Does your current Practical Focus still fit?', 'Responsibilities and resources change.', 'fits:It still fits|adjust:I want to adjust it|pause:I want to pause it|complete:It feels complete|drop:I want to let it go'),
    q('Check the priority', 'Are the same practical tasks still important?', 'An old task can lose its urgency or stop being needed.', 'same:Yes, much the same|fewer:Only some still matter|different:Different tasks matter now|none:They no longer matter|unsure:I am not sure'),
    q('Check the barrier', 'Is the same thing still making tasks difficult?', 'Choose what is true now.', 'same:Yes, much the same|different:Something different|easier:The load is easier|varies:It varies|external:The constraint is outside my control'),
    q('Choose what happens next', 'What should happen with this Practical Focus?', 'Continuing is only one option.', 'continue:Continue as it is|reshape:Reshape it|delegate:Share more of it|pause:Pause it|complete:Close this chapter'),
  ],
  bonds: {
    2: q('You know each other better', 'How would you like Errandimp to support practical tasks?', 'Choose support, not supervision.', 'one-step:Show one next step|prioritise:Help me choose what matters|combine:Notice useful combinations|limits:Respect my limits'),
    3: q('A pattern between you', 'What have you learned about handling practical tasks?', 'Choose the condition that has become clearest.', 'small:Small steps help|early:Earlier helps|batch:Combining helps|support:Support helps|capacity:My capacity changes'),
    4: q('A shared history', 'What should Errandimp carry forward?', 'Choose the practical lesson worth keeping.', 'systems:A simple system|support:Who or what helps|limits:My real limits|closed:Loops I closed|permission:Permission to let things wait'),
  },
};

const skylo: Pack = {
  pulses: [
    q('Notice the local world', 'What kind of local moment was available today?', 'A street, view, journey, building, or no exploration can all count.', 'route:An everyday route|stop:A local stop|view:A view from indoors or transport|place:A public place|none:No local moment today'),
    q('Keep one city detail', 'What local detail caught your attention?', 'Choose something specific rather than searching for a landmark.', 'building:A building detail|sign:A sign or graphic|movement:How people or traffic moved|sound:A sound|light:Light or weather'),
    q('Find what helps', 'What made local exploration easier?', 'Familiarity, safety, access, time, and transport all matter.', 'familiar:A familiar area|safe:Feeling safe|time:Enough time|transport:Accessible transport or routes|company:Company'),
    q('Respect access', 'What limited local exploration today?', 'Safety, mobility, cost, weather, and caring responsibilities are real constraints.', 'safety:Safety or comfort|mobility:Mobility or energy|cost:Cost|weather:Weather or darkness|time:Time or responsibilities'),
    q('Change the view', 'What made a familiar place look different?', 'A new angle, time, pace, or purpose can be enough.', 'angle:A different angle|time:A different time of day|pace:A slower pace|purpose:A different reason for being there|nothing:It looked much the same'),
    q('Read the feeling', 'How did the local environment feel today?', 'A place can feel lively, tiring, familiar, strange, or mixed.', 'lively:Lively|calm:Calm|tiring:Tiring|familiar:Familiar|mixed:Mixed'),
    q('Choose what is realistic', 'What kind of local discovery would suit the next few days?', 'Keep it safe, accessible, and low-cost if needed.', 'detail:Notice one nearby detail|stop:Visit one saved stop|route:Try a small route change|learn:Look up one local story|none:No plan for now'),
    q('Notice belonging', 'Where did you feel at home—or out of place—locally?', 'Choose the closest experience; belonging is not guaranteed.', 'familiar-place:A familiar place|community:A community space|anonymous:I liked being anonymous|out-of-place:I felt out of place|none:No such moment'),
    q('Read how a place works', 'What did you notice about how a local place works?', 'Think about access, movement, use, design, or change.', 'access:How people enter or move|purpose:What the place is for|design:A design detail|change:Something changing|unclear:I did not notice'),
    q('Keep a safe curiosity', 'What local question appeared?', 'Curiosity does not require entering somewhere or taking a risk.', 'history:What happened here before|design:Why it was designed this way|people:How people use it|change:What is changing|none:No question today'),
    q('Keep what works', 'What makes a local discovery worth repeating?', 'Keep one condition that supports curiosity and access.', 'close:It is close by|safe:It feels safe|free:It is free or low-cost|interesting:There is detail to notice|flexible:I can leave or adapt'),
    q('Make it kinder', 'What would make this Local Discovery Focus easier?', 'Bring it closer, shorten it, adapt access, or pause.', 'closer:Keep it closer|shorter:Make it shorter|transport:Use an accessible route|indoors:Include indoor views|pause:Pause it for now'),
  ],
  reviews: [
    q('See what draws you', 'Across recent local moments, what has held your attention?', 'Ordinary details count as much as destinations.', 'design:Buildings and design|people:How places are used|history:Local history|change:Changes over time|unclear:Nothing is clear yet'),
    q('Notice what changed', 'What has changed since you chose this Local Focus?', 'Attention, confidence, and knowing your limits all count.', 'notice-more:I notice more detail|know-more:I know the area better|visit:I visit more places|access:I understand access better|no-change:Nothing has clearly changed'),
    q('Make the Focus fit', 'What would make local discovery more realistic now?', 'Adapt distance, cost, timing, or setting.', 'closer:Closer to home|shorter:Shorter moments|free:Free options|safer:Safer times or routes|pause:A pause for now'),
    q('Choose what continues', 'What would you most like to carry into the next week?', 'Choose one thread of local curiosity.', 'detail:City details|place:A place to return to|history:A local story|route:A familiar route seen differently|access:What feels accessible'),
  ],
  returns: [
    q('Does this still fit?', 'Does your current Local Discovery Focus still fit?', 'Places, routines, safety, and access change.', 'fits:It still fits|adjust:I want to adjust it|closer:I need a closer version|pause:I want to pause it|complete:It feels complete'),
    q('Check the curiosity', 'Do you still want the same thing from local exploration?', 'Your interest may move between places, stories, details, and belonging.', 'same:Yes, the same thing|places:I want places|stories:I want stories|details:I want details|unsure:I am not sure'),
    q('Check access', 'Is the same thing still limiting local discovery?', 'Choose what is true now.', 'same:Yes, much the same|different:Something different|easier:Access is easier|varies:It varies|no-barrier:There is no clear barrier'),
    q('Choose what happens next', 'What would you like to do with this Local Focus?', 'Continuing, adapting, pausing, and finishing are all valid.', 'continue:Continue as it is|adapt:Change how or where|new-thread:Follow a new curiosity|pause:Pause it|complete:Mark it complete'),
  ],
  bonds: {
    2: q('You know each other better', 'How would you like Skylo to support local discovery?', 'Choose support that respects safety, cost, and access.', 'nearby:Keep ideas nearby|details:Prompt one detail|stories:Offer local questions|flexible:Keep it flexible'),
    3: q('A pattern between you', 'What have you learned about how you explore?', 'Choose the clearest pattern.', 'walking:I notice while moving|stopping:I notice when I stop|stories:Stories draw me in|design:Design draws me in|access:Access shapes everything'),
    4: q('A shared history', 'What should Skylo carry forward?', 'Choose what future local invitations should remember.', 'places:Places that mattered|routes:Familiar routes|details:Details I noticed|stories:Stories I learned|boundaries:My access and safety needs'),
  },
};

export const BATCH_TWO_COMPANION_CONTENT: Readonly<Record<string, Pack>> = {
  feastle,
  'coffee-ritual': coffeeRitual,
  errandimp,
  skylo,
};
