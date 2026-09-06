import type { EditorialCompanionProfile, EditorialOptions } from '@/constants/editorial-companion-pack';
import {
  createSpecialistCompanionSystem,
  type SpecialistCompanionSystemConfig,
} from '@/constants/specialist-companion-system';

type EditorialSeed = {
  companionName: string;
  focusName: string;
  momentName: string;
  kinds: EditorialOptions;
  effects: EditorialOptions;
  supports: EditorialOptions;
  barriers: EditorialOptions;
  details: EditorialOptions;
  next: EditorialOptions;
  conditions: EditorialOptions;
  learning: EditorialOptions;
  keep: EditorialOptions;
  adapt: EditorialOptions;
};

function editorial(seed: EditorialSeed): EditorialCompanionProfile {
  return {
    ...seed,
    fit: [
      ['fit', 'It fitted comfortably'],
      ['smaller', 'A smaller version fitted'],
      ['adapted', 'I adapted it to my needs'],
      ['other', 'I chose something else'],
      ['none', 'It did not fit today'],
    ],
    limits: [
      ['capacity', 'My time, energy, or appetite'],
      ['access', 'Cost, access, or availability'],
      ['needs', 'Health, sensory, allergy, or dietary needs'],
      ['boundary', 'A social or personal boundary'],
      ['none', 'No limit stood out'],
    ],
  };
}

const configs = [
  {
    familyId: 'crumbun', journeyId: 'crumbun-baking-ritual', title: 'A baking rhythm', subject: 'baking and bakery moments',
    introduction: 'Explore bread, pastry, and baking through taste, craft, sharing, and small returns. Buying something, adapting a recipe, or deciding not to bake can all be honest parts of the Focus.',
    first: {
      prompt: 'What draws you towards baking or bakeries?',
      helperText: 'Choose the part you would genuinely like more of, not the answer that sounds most accomplished.',
      options: [['comfort', 'Comfort and familiar rituals'], ['craft', 'Learning how baking works'], ['discovery', 'Finding breads or pastries'], ['sharing', 'Making or choosing something for others'], ['curious', 'I am still finding out']],
    },
    second: {
      prompt: 'What most affects whether a baking moment happens?',
      helperText: 'Time, money, equipment, dietary needs, and energy are conditions—not failures.',
      options: [['time', 'Time or energy'], ['access', 'Ingredients, equipment, or cost'], ['confidence', 'Knowing where to begin'], ['needs', 'Dietary, allergy, or sensory needs'], ['varies', 'It varies from week to week']],
    },
    directions: [
      { id: 'make', label: 'Make something manageable', goalTitle: 'Build a manageable baking rhythm', quickGoalSuffixes: ['choose-bake', 'one-baking-step', 'adapt-recipe'] },
      { id: 'discover', label: 'Explore bakery finds', goalTitle: 'Explore breads and pastries with attention', quickGoalSuffixes: ['notice-bake', 'bakery-option'] },
      { id: 'learn', label: 'Learn one baking skill', goalTitle: 'Learn through small baking experiments', quickGoalSuffixes: ['learn-technique', 'keep-result'] },
      { id: 'share', label: 'Use baking for connection', goalTitle: 'Create thoughtful baking moments', quickGoalSuffixes: ['share-bake', 'ask-preference'] },
    ],
    quickGoals: [
      { suffix: 'choose-bake', title: 'Choose one realistic thing I could bake' },
      { suffix: 'one-baking-step', title: 'Complete one useful baking step' },
      { suffix: 'adapt-recipe', title: 'Adapt one recipe detail to fit my needs' },
      { suffix: 'notice-bake', title: 'Notice one taste, texture, or craft detail' },
      { suffix: 'bakery-option', title: 'Find one accessible bakery option without needing to buy it' },
      { suffix: 'learn-technique', title: 'Learn one baking technique or ingredient role' },
      { suffix: 'keep-result', title: 'Keep one honest note about what happened' },
      { suffix: 'share-bake', title: 'Offer or choose a bake for someone if appropriate' },
      { suffix: 'ask-preference', title: 'Ask what someone would actually enjoy before sharing' },
    ],
    editorial: editorial({
      companionName: 'Crumbun', focusName: 'baking', momentName: 'baking or bakery moment',
      kinds: [['made', 'Something I made'], ['found', 'A bakery find'], ['learned', 'A craft detail'], ['shared', 'Something chosen or shared'], ['none', 'No baking moment']],
      effects: [['comfort', 'Comfort'], ['curiosity', 'Curiosity'], ['connection', 'Connection'], ['frustration', 'Frustration or effort'], ['mixed', 'Mixed or no clear effect']],
      supports: [['time', 'Enough unhurried time'], ['recipe', 'A clear recipe or next step'], ['access', 'Suitable ingredients or equipment'], ['company', 'Company or shared interest'], ['small', 'Keeping it small']],
      barriers: [['energy', 'Time or energy'], ['access', 'Cost, ingredients, or equipment'], ['needs', 'Dietary, allergy, or sensory needs'], ['confidence', 'Uncertainty about the process'], ['interest', 'I did not want to bake']],
      details: [['taste', 'Taste or aroma'], ['texture', 'Texture'], ['technique', 'A technique'], ['ingredient', 'An ingredient choice'], ['gesture', 'The meaning of sharing it']],
      next: [['small', 'A very small bake'], ['learn', 'One skill or ingredient'], ['bakery', 'A bakery look or visit'], ['share', 'A thoughtful sharing moment'], ['none', 'No baking task for now']],
      conditions: [['capacity', 'My available capacity'], ['ingredients', 'Ingredients and equipment'], ['needs', 'Dietary or sensory needs'], ['occasion', 'An occasion or person'], ['curiosity', 'What I felt curious about']],
      learning: [['taste', 'What I genuinely enjoy'], ['process', 'Which process suits me'], ['size', 'What scale is manageable'], ['sharing', 'How I like to share food'], ['varies', 'It changes each time']],
      keep: [['ritual', 'A comforting ritual'], ['skill', 'One useful skill'], ['find', 'A bakery discovery'], ['connection', 'A connecting gesture'], ['honesty', 'An honest result, including imperfect ones']],
      adapt: [['smaller', 'Choose a smaller bake'], ['buy', 'Choose rather than make'], ['substitute', 'Use a suitable substitution'], ['help', 'Bake with support'], ['pause', 'Pause the Focus']],
    }),
  },
  {
    familyId: 'hayhorn', journeyId: 'hayhorn-ingredient-origins', title: 'An ingredient trail', subject: 'ingredients and food origins',
    introduction: 'Notice where ingredients come from, what is seasonal, and how food reaches you—without turning cost, locality, or access into a moral score.',
    first: {
      prompt: 'What would you most like to understand about your ingredients?',
      helperText: 'You can begin with an ordinary item already available to you.',
      options: [['origin', 'Where something came from'], ['season', 'What changes with the season'], ['people', 'The people or work behind it'], ['cooking', 'How to use one ingredient well'], ['curious', 'I am not sure yet']],
    },
    second: {
      prompt: 'What shapes your ingredient choices most right now?',
      helperText: 'Budget, availability, culture, health needs, and convenience are all legitimate.',
      options: [['budget', 'Budget'], ['availability', 'What is available nearby'], ['needs', 'Dietary or health needs'], ['culture', 'Culture, household, or preference'], ['time', 'Time and convenience']],
    },
    directions: [
      { id: 'trace', label: 'Trace ordinary ingredients', goalTitle: 'Learn where ordinary ingredients come from', quickGoalSuffixes: ['read-origin', 'ask-origin'] },
      { id: 'season', label: 'Notice seasonal change', goalTitle: 'Notice what changes through the seasons', quickGoalSuffixes: ['spot-seasonal', 'compare-season'] },
      { id: 'use', label: 'Cook around one ingredient', goalTitle: 'Use one ingredient with more attention', quickGoalSuffixes: ['choose-ingredient', 'simple-use'] },
      { id: 'market', label: 'Explore a source or market', goalTitle: 'Explore where food is sourced when accessible', quickGoalSuffixes: ['market-option', 'producer-detail'] },
    ],
    quickGoals: [
      { suffix: 'read-origin', title: 'Read where one ingredient came from' },
      { suffix: 'ask-origin', title: 'Ask one respectful question about an ingredient' },
      { suffix: 'spot-seasonal', title: 'Notice one ingredient described as seasonal' },
      { suffix: 'compare-season', title: 'Compare one ingredient with another time of year' },
      { suffix: 'choose-ingredient', title: 'Choose one ingredient already available to explore' },
      { suffix: 'simple-use', title: 'Use one ingredient in a manageable way' },
      { suffix: 'market-option', title: 'Find one accessible market or source option without needing to visit' },
      { suffix: 'producer-detail', title: 'Learn one concrete producer or growing detail' },
    ],
    editorial: editorial({
      companionName: 'Hayhorn', focusName: 'food origins', momentName: 'ingredient-origin moment',
      kinds: [['label', 'Reading a label or menu'], ['season', 'A seasonal detail'], ['source', 'A shop, market, grower, or producer'], ['cooked', 'Cooking around one ingredient'], ['none', 'No origin moment']],
      effects: [['curiosity', 'Curiosity'], ['connection', 'Connection to place or people'], ['choice', 'A clearer choice'], ['pressure', 'Pressure or complication'], ['mixed', 'Mixed or no clear effect']],
      supports: [['information', 'Clear information'], ['budget', 'A workable price'], ['availability', 'Nearby availability'], ['knowledge', 'Someone sharing knowledge'], ['simple', 'Starting with one ingredient']],
      barriers: [['cost', 'Cost'], ['access', 'Availability or transport'], ['information', 'Missing or unclear information'], ['needs', 'Dietary or health needs'], ['time', 'Time or capacity']],
      details: [['place', 'A place of origin'], ['season', 'A seasonal detail'], ['method', 'How it was grown or made'], ['people', 'The people behind it'], ['use', 'How I used it']],
      next: [['label', 'Read one label or menu'], ['season', 'Notice one seasonal item'], ['cook', 'Use one ingredient'], ['source', 'Explore one source'], ['none', 'No sourcing task now']],
      conditions: [['budget', 'Budget'], ['access', 'Local availability'], ['needs', 'Dietary needs'], ['household', 'Household preferences'], ['time', 'Time and convenience']],
      learning: [['origins', 'Which origins interest me'], ['season', 'How seasons show up'], ['access', 'What is realistically accessible'], ['cooking', 'How origin changes use'], ['varies', 'There is no simple pattern']],
      keep: [['question', 'One useful question'], ['ingredient', 'One ingredient discovery'], ['context', 'Context about people or place'], ['recipe', 'A manageable use'], ['fairness', 'A non-judgemental view of access']],
      adapt: [['closer', 'Choose something already nearby'], ['cheaper', 'Use a lower-cost example'], ['digital', 'Explore without travelling'], ['simple', 'Follow one detail only'], ['pause', 'Pause the Focus']],
    }),
  },
  {
    familyId: 'crustling', journeyId: 'crustling-pizza-ritual', title: 'A pizza ritual', subject: 'pizza making, choosing, and sharing',
    introduction: 'Explore pizza as food, craft, place, or shared occasion. Homemade, bought, adapted, frozen, and solo pizza moments can all count.',
    first: {
      prompt: 'What makes a pizza moment worth remembering for you?',
      helperText: 'Choose the experience, not the most impressive version.',
      options: [['taste', 'A combination that works'], ['making', 'Making or customising it'], ['place', 'A place with character'], ['company', 'Who I share it with'], ['ease', 'An easy, comforting meal']],
    },
    second: {
      prompt: 'What usually decides which pizza moment is possible?',
      helperText: 'Access and capacity matter as much as preference.',
      options: [['time', 'Time or energy'], ['cost', 'Cost or availability'], ['needs', 'Dietary, allergy, or sensory needs'], ['company', 'Who is there'], ['mood', 'What sounds good that day']],
    },
    directions: [
      { id: 'taste', label: 'Understand my combinations', goalTitle: 'Learn which pizza combinations I enjoy', quickGoalSuffixes: ['notice-combination', 'compare-crust'] },
      { id: 'make', label: 'Make or customise pizza', goalTitle: 'Build a manageable pizza-making ritual', quickGoalSuffixes: ['choose-base', 'customise-one'] },
      { id: 'place', label: 'Explore pizza places', goalTitle: 'Explore accessible pizza places with attention', quickGoalSuffixes: ['find-place', 'keep-place-detail'] },
      { id: 'share', label: 'Create a shared pizza moment', goalTitle: 'Use pizza for an easy shared occasion', quickGoalSuffixes: ['ask-order', 'share-pizza'] },
    ],
    quickGoals: [
      { suffix: 'notice-combination', title: 'Notice one topping, sauce, or cheese combination' },
      { suffix: 'compare-crust', title: 'Compare one crust or base detail' },
      { suffix: 'choose-base', title: 'Choose one manageable base or pizza option' },
      { suffix: 'customise-one', title: 'Customise one pizza detail to suit me' },
      { suffix: 'find-place', title: 'Find one accessible pizza option without needing to order' },
      { suffix: 'keep-place-detail', title: 'Keep one detail about a pizza place' },
      { suffix: 'ask-order', title: 'Ask what others actually want before ordering' },
      { suffix: 'share-pizza', title: 'Make room for one shared or intentional solo pizza moment' },
    ],
    editorial: editorial({
      companionName: 'Crustling', focusName: 'pizza rituals', momentName: 'pizza moment',
      kinds: [['made', 'Made or customised'], ['ordered', 'Ordered or collected'], ['place', 'A place visit'], ['shared', 'A shared occasion'], ['easy', 'An easy solo meal or no moment']],
      effects: [['enjoyment', 'Enjoyment'], ['comfort', 'Comfort or ease'], ['connection', 'Connection'], ['learning', 'A clearer preference'], ['mixed', 'Mixed or no clear effect']],
      supports: [['choice', 'A combination I wanted'], ['ease', 'An easy option'], ['needs', 'An option that met my needs'], ['company', 'Good company or solitude'], ['budget', 'A workable cost']],
      barriers: [['cost', 'Cost or availability'], ['needs', 'Dietary, allergy, or sensory needs'], ['energy', 'Time or energy'], ['choice', 'Too many or too few options'], ['none', 'I did not want pizza']],
      details: [['crust', 'Crust or base'], ['sauce', 'Sauce'], ['topping', 'Toppings'], ['place', 'The place or setting'], ['company', 'The shared moment']],
      next: [['usual', 'Return to a favourite'], ['change', 'Try one small change'], ['make', 'Make or customise'], ['share', 'Plan an easy shared moment'], ['none', 'No pizza task now']],
      conditions: [['appetite', 'Appetite or mood'], ['access', 'Cost and availability'], ['needs', 'Food needs'], ['company', 'Company or solitude'], ['capacity', 'Time and energy']],
      learning: [['combination', 'Which combinations work'], ['occasion', 'Which occasions suit it'], ['making', 'How much making I enjoy'], ['place', 'What makes a place worth returning to'], ['varies', 'My preference varies']],
      keep: [['favourite', 'A favourite combination'], ['easy', 'An easy option'], ['craft', 'A making detail'], ['connection', 'A shared ritual'], ['permission', 'Permission for ordinary pizza to count']],
      adapt: [['simpler', 'Choose a simpler option'], ['needs', 'Adapt it to my food needs'], ['solo', 'Make it an intentional solo moment'], ['share', 'Share the choosing'], ['pause', 'Pause the Focus']],
    }),
  },
  {
    familyId: 'nigirimp', journeyId: 'nigirimp-japanese-food-discovery', title: 'A Japanese food path', subject: 'Japanese food discovery',
    introduction: 'Explore real Japanese dishes, ingredients, preparation, and context with curiosity and respect. There is no test of expertise or “authentic” taste.',
    first: {
      prompt: 'What would you like to notice more closely in Japanese food?',
      helperText: 'Begin from your own access and experience. Familiar and new dishes both count.',
      options: [['flavour', 'Flavour and balance'], ['craft', 'Preparation and presentation'], ['variety', 'Different dishes and ingredients'], ['context', 'Regional or cultural context'], ['favourite', 'Understanding what I enjoy']],
    },
    second: {
      prompt: 'What most shapes what you can explore?',
      helperText: 'Availability, cost, dietary needs, confidence, and prior knowledge are practical conditions.',
      options: [['access', 'What is available nearby'], ['cost', 'Cost'], ['needs', 'Dietary, allergy, or sensory needs'], ['knowledge', 'Knowing what something is'], ['familiarity', 'How unfamiliar it feels']],
    },
    directions: [
      { id: 'notice', label: 'Notice dishes more closely', goalTitle: 'Build a more attentive Japanese food practice', quickGoalSuffixes: ['keep-dish', 'notice-balance'] },
      { id: 'try', label: 'Try something unfamiliar', goalTitle: 'Explore unfamiliar Japanese dishes at my pace', quickGoalSuffixes: ['find-option', 'one-change'] },
      { id: 'learn', label: 'Learn context and craft', goalTitle: 'Learn the context behind Japanese dishes', quickGoalSuffixes: ['learn-name', 'learn-context'] },
      { id: 'return', label: 'Develop a favourite', goalTitle: 'Understand and return to Japanese dishes I enjoy', quickGoalSuffixes: ['name-favourite', 'return-detail'] },
    ],
    quickGoals: [
      { suffix: 'keep-dish', title: 'Keep the name of one Japanese dish I encountered' },
      { suffix: 'notice-balance', title: 'Notice one flavour, texture, or presentation detail' },
      { suffix: 'find-option', title: 'Find one suitable Japanese food option without needing to buy it' },
      { suffix: 'one-change', title: 'Try one manageable change from my usual choice' },
      { suffix: 'learn-name', title: 'Learn how one dish or ingredient is described' },
      { suffix: 'learn-context', title: 'Learn one reliable cultural, regional, or preparation detail' },
      { suffix: 'name-favourite', title: 'Name what I genuinely enjoy in one dish' },
      { suffix: 'return-detail', title: 'Notice one new detail in a familiar dish' },
    ],
    editorial: editorial({
      companionName: 'Nigirimp', focusName: 'Japanese food discovery', momentName: 'Japanese food moment',
      kinds: [['familiar', 'A familiar dish'], ['new', 'Something new to me'], ['ingredient', 'An ingredient or technique'], ['context', 'A context detail'], ['none', 'No food moment']],
      effects: [['enjoyment', 'Enjoyment'], ['curiosity', 'Curiosity'], ['surprise', 'Surprise'], ['uncertainty', 'Uncertainty or discomfort'], ['mixed', 'Mixed or no clear effect']],
      supports: [['description', 'A clear description'], ['trusted', 'A trusted recommendation'], ['needs', 'Suitable food options'], ['pace', 'Going at my own pace'], ['context', 'Useful context']],
      barriers: [['access', 'Availability or cost'], ['needs', 'Dietary, allergy, or sensory needs'], ['language', 'Unfamiliar names or descriptions'], ['pressure', 'Pressure to know or like it'], ['confidence', 'Not knowing where to begin']],
      details: [['ingredient', 'An ingredient'], ['texture', 'Texture'], ['balance', 'Flavour balance'], ['presentation', 'Preparation or presentation'], ['context', 'Regional or cultural context']],
      next: [['familiar', 'Return to something familiar'], ['new', 'Try one new-to-me option'], ['learn', 'Learn one context detail'], ['compare', 'Compare two preparations'], ['none', 'No food task now']],
      conditions: [['access', 'Availability and cost'], ['needs', 'Food needs'], ['knowledge', 'Clear information'], ['company', 'Company or recommendation'], ['appetite', 'Appetite and interest']],
      learning: [['flavour', 'Which flavours I enjoy'], ['texture', 'Which textures suit me'], ['craft', 'Which craft details interest me'], ['context', 'Which context deepens the meal'], ['varies', 'My response varies']],
      keep: [['dish', 'A dish worth returning to'], ['detail', 'A preparation detail'], ['question', 'A respectful question'], ['context', 'Reliable context'], ['openness', 'Curiosity without pressure']],
      adapt: [['familiar', 'Start from a familiar dish'], ['needs', 'Choose a suitable alternative'], ['learn', 'Learn without ordering'], ['small', 'Try one small component'], ['pause', 'Pause the Focus']],
    }),
  },
  {
    familyId: 'noodloo', journeyId: 'noodloo-noodle-trail', title: 'A noodle trail', subject: 'noodle meals and making',
    introduction: 'Explore noodle dishes through broths, sauces, textures, places, and comforting returns. Any cuisine, suitable adaptation, or easy home bowl can belong.',
    first: {
      prompt: 'What do you most enjoy exploring in a noodle dish?',
      helperText: 'Choose the part that actually holds your attention.',
      options: [['broth', 'Broths or sauces'], ['noodle', 'Noodle texture and shape'], ['toppings', 'Toppings and combinations'], ['place', 'Different places or cuisines'], ['comfort', 'A familiar, comforting bowl']],
    },
    second: {
      prompt: 'What usually decides which noodle moment fits?',
      helperText: 'Convenience and food needs are valid parts of the answer.',
      options: [['time', 'Time or energy'], ['access', 'Cost or availability'], ['needs', 'Dietary, allergy, or sensory needs'], ['confidence', 'Cooking confidence'], ['appetite', 'What sounds manageable']],
    },
    directions: [
      { id: 'notice', label: 'Understand my favourite bowls', goalTitle: 'Learn what makes a noodle bowl work for me', quickGoalSuffixes: ['keep-bowl', 'notice-texture'] },
      { id: 'explore', label: 'Explore noodle styles', goalTitle: 'Explore different noodle styles at my pace', quickGoalSuffixes: ['find-style', 'compare-style'] },
      { id: 'make', label: 'Build manageable bowls', goalTitle: 'Build a manageable noodle-making rhythm', quickGoalSuffixes: ['choose-bowl', 'customise-bowl'] },
      { id: 'comfort', label: 'Protect an easy comfort meal', goalTitle: 'Keep an easy noodle option that supports me', quickGoalSuffixes: ['easy-option', 'prepare-one'] },
    ],
    quickGoals: [
      { suffix: 'keep-bowl', title: 'Keep one detail from a noodle bowl' },
      { suffix: 'notice-texture', title: 'Notice one noodle or topping texture' },
      { suffix: 'find-style', title: 'Find one noodle style I could explore without needing to order it' },
      { suffix: 'compare-style', title: 'Compare one broth, sauce, or noodle style' },
      { suffix: 'choose-bowl', title: 'Choose one manageable noodle bowl to make' },
      { suffix: 'customise-bowl', title: 'Customise one bowl detail to fit my needs' },
      { suffix: 'easy-option', title: 'Identify one easy noodle option for a lower-capacity day' },
      { suffix: 'prepare-one', title: 'Prepare one useful bowl component' },
    ],
    editorial: editorial({
      companionName: 'Noodloo', focusName: 'noodle meals', momentName: 'noodle moment',
      kinds: [['home', 'A home bowl'], ['place', 'A restaurant or takeaway bowl'], ['new', 'A new style'], ['familiar', 'A familiar comfort bowl'], ['none', 'No noodle moment']],
      effects: [['comfort', 'Comfort'], ['interest', 'Interest or discovery'], ['satisfaction', 'Satisfaction'], ['effort', 'More effort than expected'], ['mixed', 'Mixed or no clear effect']],
      supports: [['easy', 'An easy preparation'], ['ingredients', 'Suitable ingredients'], ['description', 'A clear menu or recipe'], ['familiar', 'A familiar combination'], ['time', 'Enough time']],
      barriers: [['access', 'Cost or availability'], ['needs', 'Dietary, allergy, or sensory needs'], ['energy', 'Time or energy'], ['choice', 'Too many choices'], ['appetite', 'It did not appeal today']],
      details: [['broth', 'Broth or sauce'], ['noodle', 'Noodle shape or texture'], ['topping', 'A topping'], ['aroma', 'Aroma or heat'], ['setting', 'The place or setting']],
      next: [['easy', 'An easy familiar bowl'], ['new', 'One new style'], ['make', 'A simple home bowl'], ['compare', 'Compare one detail'], ['none', 'No noodle task now']],
      conditions: [['capacity', 'Time and energy'], ['access', 'Cost and availability'], ['needs', 'Food needs'], ['weather', 'Weather or comfort'], ['company', 'Company or solitude']],
      learning: [['texture', 'Which textures suit me'], ['flavour', 'Which broths or sauces I enjoy'], ['effort', 'What is manageable to make'], ['place', 'Which places are worth returning to'], ['varies', 'My preference varies']],
      keep: [['bowl', 'A reliable bowl'], ['detail', 'A flavour or texture detail'], ['recipe', 'A manageable method'], ['place', 'A place worth returning to'], ['comfort', 'The comfort of an ordinary meal']],
      adapt: [['simpler', 'Make the bowl simpler'], ['needs', 'Adapt ingredients to my needs'], ['prepared', 'Use prepared components'], ['buy', 'Choose rather than cook'], ['pause', 'Pause the Focus']],
    }),
  },
  {
    familyId: 'sundael', journeyId: 'sundael-dessert-occasions', title: 'Intentional treats', subject: 'dessert and sweet moments',
    introduction: 'Explore desserts through taste, making, occasion, and sharing without moralising food, appetite, health, or frequency.',
    first: {
      prompt: 'What makes a dessert moment feel worthwhile to you?',
      helperText: 'This is about preference and meaning, not earning or justifying food.',
      options: [['flavour', 'A flavour I genuinely enjoy'], ['craft', 'Making or noticing the craft'], ['occasion', 'Marking an occasion'], ['sharing', 'Sharing with someone'], ['pause', 'A small enjoyable pause']],
    },
    second: {
      prompt: 'What most shapes whether a sweet moment fits?',
      helperText: 'Appetite, health needs, access, culture, and simply not wanting one are all valid.',
      options: [['appetite', 'Appetite or preference'], ['needs', 'Health, dietary, allergy, or sensory needs'], ['access', 'Cost or availability'], ['occasion', 'The occasion or company'], ['interest', 'Whether I actually want it']],
    },
    directions: [
      { id: 'taste', label: 'Understand what I enjoy', goalTitle: 'Notice what makes a dessert enjoyable for me', quickGoalSuffixes: ['notice-dessert', 'name-preference'] },
      { id: 'make', label: 'Make something manageable', goalTitle: 'Build a manageable dessert-making practice', quickGoalSuffixes: ['choose-sweet', 'one-dessert-step'] },
      { id: 'explore', label: 'Try occasional new flavours', goalTitle: 'Explore dessert flavours without pressure', quickGoalSuffixes: ['find-option', 'try-change'] },
      { id: 'share', label: 'Create a thoughtful occasion', goalTitle: 'Use dessert for thoughtful shared or solo occasions', quickGoalSuffixes: ['ask-preference', 'mark-moment'] },
    ],
    quickGoals: [
      { suffix: 'notice-dessert', title: 'Notice one flavour, texture, or temperature detail' },
      { suffix: 'name-preference', title: 'Name what I genuinely enjoyed or did not enjoy' },
      { suffix: 'choose-sweet', title: 'Choose one manageable sweet thing to make if I want to' },
      { suffix: 'one-dessert-step', title: 'Complete one useful dessert-making step' },
      { suffix: 'find-option', title: 'Find one suitable dessert option without needing to buy it' },
      { suffix: 'try-change', title: 'Try one small flavour change if it appeals' },
      { suffix: 'ask-preference', title: 'Ask about preferences and food needs before sharing' },
      { suffix: 'mark-moment', title: 'Make one dessert or non-dessert pause feel intentional' },
    ],
    editorial: editorial({
      companionName: 'Sundael', focusName: 'dessert moments', momentName: 'dessert or treat moment',
      kinds: [['chosen', 'Something deliberately chosen'], ['made', 'Something made'], ['shared', 'A shared occasion'], ['alternative', 'A suitable alternative or different pleasure'], ['none', 'No dessert moment']],
      effects: [['enjoyment', 'Enjoyment'], ['connection', 'Connection'], ['curiosity', 'Curiosity'], ['neutral', 'It felt ordinary or neutral'], ['mixed', 'Mixed or uncomfortable']],
      supports: [['want', 'Actually wanting it'], ['needs', 'An option that suited my needs'], ['company', 'The right company or solitude'], ['occasion', 'A meaningful occasion'], ['attention', 'Enough attention to enjoy it']],
      barriers: [['needs', 'Health, dietary, allergy, or sensory needs'], ['access', 'Cost or availability'], ['pressure', 'Food rules or social pressure'], ['appetite', 'I did not want it'], ['capacity', 'Time or energy']],
      details: [['flavour', 'Flavour'], ['texture', 'Texture'], ['temperature', 'Temperature'], ['presentation', 'Making or presentation'], ['occasion', 'The occasion around it']],
      next: [['favourite', 'Return to a favourite'], ['new', 'Try one new flavour'], ['make', 'Make something small'], ['occasion', 'Mark an occasion'], ['none', 'No dessert task now']],
      conditions: [['appetite', 'Appetite and preference'], ['needs', 'Food or health needs'], ['access', 'Cost and availability'], ['company', 'Company or solitude'], ['occasion', 'The occasion']],
      learning: [['taste', 'Which tastes I enjoy'], ['portion', 'What amount feels right for me'], ['occasion', 'Which occasions matter'], ['making', 'Whether I enjoy making'], ['varies', 'My response varies']],
      keep: [['pleasure', 'Pleasure without judgement'], ['favourite', 'A genuine favourite'], ['craft', 'A making detail'], ['connection', 'A shared occasion'], ['choice', 'Permission to choose something else']],
      adapt: [['alternative', 'Choose a suitable alternative'], ['smaller', 'Make or choose less'], ['different', 'Mark the occasion another way'], ['share', 'Share the choice'], ['pause', 'Pause the Focus']],
    }),
  },
  {
    familyId: 'bobaloo', journeyId: 'bobaloo-playful-drinks', title: 'A playful drink trail', subject: 'bubble tea and playful drink moments',
    introduction: 'Explore flavour combinations, textures, and easy drink pauses without assuming caffeine, sugar, spending, travel, or company suits you.',
    first: {
      prompt: 'What do you most enjoy about a playful drink?',
      helperText: 'Choose the experience you care about, including the pause around it.',
      options: [['flavour', 'Flavour combinations'], ['texture', 'Toppings or texture'], ['choice', 'Building an order'], ['social', 'A shared drink stop'], ['pause', 'A small solo pause']],
    },
    second: {
      prompt: 'What most affects whether a drink moment fits?',
      helperText: 'Cost, access, caffeine, sugar, allergies, and sensory preferences can all shape the choice.',
      options: [['access', 'Cost or availability'], ['needs', 'Health, allergy, or dietary needs'], ['caffeine', 'Caffeine or sweetness'], ['choice', 'Too many unfamiliar choices'], ['company', 'Whether I want company or quiet']],
    },
    directions: [
      { id: 'order', label: 'Understand my order', goalTitle: 'Learn which playful drink choices suit me', quickGoalSuffixes: ['notice-order', 'name-favourite'] },
      { id: 'explore', label: 'Explore combinations', goalTitle: 'Explore drink combinations at my pace', quickGoalSuffixes: ['find-option', 'one-change'] },
      { id: 'pause', label: 'Create an intentional pause', goalTitle: 'Use a suitable drink or alternative for an intentional pause', quickGoalSuffixes: ['choose-pause', 'notice-setting'] },
      { id: 'share', label: 'Share a drink stop', goalTitle: 'Create easy, consent-aware shared drink moments', quickGoalSuffixes: ['ask-needs', 'invite-drink'] },
    ],
    quickGoals: [
      { suffix: 'notice-order', title: 'Notice one base, flavour, sweetness, ice, or topping choice' },
      { suffix: 'name-favourite', title: 'Name one combination I genuinely enjoy' },
      { suffix: 'find-option', title: 'Find one suitable drink option without needing to buy it' },
      { suffix: 'one-change', title: 'Try one manageable order change if I want to' },
      { suffix: 'choose-pause', title: 'Choose a suitable drink or alternative for one intentional pause' },
      { suffix: 'notice-setting', title: 'Notice what the setting added to a drink pause' },
      { suffix: 'ask-needs', title: 'Check someone’s preferences and needs before ordering' },
      { suffix: 'invite-drink', title: 'Offer one low-pressure drink invitation' },
    ],
    editorial: editorial({
      companionName: 'Bobaloo', focusName: 'playful drinks', momentName: 'playful drink moment',
      kinds: [['usual', 'A familiar order'], ['changed', 'A changed or new order'], ['home', 'A drink made at home'], ['shared', 'A shared drink stop'], ['none', 'No drink moment']],
      effects: [['play', 'Playfulness'], ['pause', 'A useful pause'], ['connection', 'Connection'], ['learning', 'A clearer preference'], ['mixed', 'Mixed or no clear effect']],
      supports: [['choice', 'Clear choices'], ['needs', 'Suitable options'], ['budget', 'A workable cost'], ['company', 'The right company or quiet'], ['location', 'An accessible setting']],
      barriers: [['access', 'Cost or availability'], ['needs', 'Caffeine, sugar, allergy, or dietary needs'], ['choice', 'Too many choices'], ['sensory', 'Texture or sensory preferences'], ['interest', 'I did not want one']],
      details: [['base', 'The drink base'], ['flavour', 'Flavour'], ['texture', 'Topping or texture'], ['balance', 'Sweetness, ice, or balance'], ['setting', 'The pause or setting']],
      next: [['usual', 'Return to a favourite'], ['change', 'Change one detail'], ['home', 'Make a simple version'], ['share', 'Offer a shared stop'], ['none', 'No drink task now']],
      conditions: [['needs', 'Health and food needs'], ['access', 'Cost and availability'], ['mood', 'Mood and appetite'], ['company', 'Company or solitude'], ['time', 'Time for a pause']],
      learning: [['combination', 'Which combinations suit me'], ['texture', 'Which textures I enjoy'], ['needs', 'Which options meet my needs'], ['pause', 'When the pause feels useful'], ['varies', 'My preference varies']],
      keep: [['favourite', 'A favourite order'], ['choice', 'A useful order choice'], ['pause', 'An intentional pause'], ['connection', 'An easy social ritual'], ['alternative', 'A suitable non-drink alternative']],
      adapt: [['needs', 'Adjust caffeine, sweetness, or ingredients'], ['cheaper', 'Choose a lower-cost version'], ['home', 'Make something at home'], ['alternative', 'Choose another kind of pause'], ['pause', 'Pause the Focus']],
    }),
  },
] as const satisfies readonly SpecialistCompanionSystemConfig[];

export const BATCH_SEVEN_SPECIALIST_SYSTEMS = configs.map(createSpecialistCompanionSystem);

export const BATCH_SEVEN_COMPANION_CONTENT = Object.fromEntries(
  BATCH_SEVEN_SPECIALIST_SYSTEMS.map((system) => [system.familyId, system.content])
);

export const BATCH_SEVEN_SPECIALIST_JOURNEY_IDS = new Map(
  BATCH_SEVEN_SPECIALIST_SYSTEMS.map((system) => [system.familyId, system.journeyId])
);

