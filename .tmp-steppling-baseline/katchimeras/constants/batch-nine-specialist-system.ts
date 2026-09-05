import {
  createCompactSpecialistCompanionSystem,
  type CompactSpecialistCompanionSystemConfig,
} from '@/constants/specialist-companion-system';

const configs = [
  {
    familyId: 'petalimp', journeyId: 'petalimp-garden-care', title: 'A tending rhythm', subject: 'plant and garden care', companionName: 'Petalimp', focusName: 'plant care', momentName: 'tending moment',
    introduction: 'Build a realistic relationship with tending plants. A garden, balcony, windowsill, shared plot, single pot, or supported care task can count; plants changing or dying is not a personal failure.',
    firstPrompt: 'What would you like plant care to give you?', firstHelperText: 'Choose what matters in your actual space and capacity.', values: ['A small caring routine', 'Learning what plants need', 'Growing something usable or beautiful', 'Time with soil and seasons', 'Confidence after setbacks'],
    secondPrompt: 'What most affects whether tending happens?', secondHelperText: 'Space, climate, disability, cost, knowledge, and fluctuating energy all shape gardening.', barriers: ['Time or energy', 'Space, mobility, or physical access', 'Weather or growing conditions', 'Cost, tools, or materials', 'Uncertainty about what the plant needs'],
    moments: ['Watering or checking', 'Pruning, planting, or repotting', 'Noticing growth or a problem', 'Learning or preparing', 'No tending moment'], supports: ['A small clear task', 'Accessible tools or setup', 'A workable routine', 'Reliable plant information', 'Help from another person'], details: ['New growth', 'Soil or moisture', 'Light or temperature', 'A pest or health change', 'The result of one care choice'],
    directions: [
      { id: 'routine', label: 'Build a small care routine', goalTitle: 'Build a plant-care rhythm that fits', quickGoalSuffixes: ['check-one', 'choose-routine'] },
      { id: 'learn', label: 'Learn one plant well', goalTitle: 'Learn what one plant needs', quickGoalSuffixes: ['identify-need', 'reliable-source'] },
      { id: 'grow', label: 'Grow something manageable', goalTitle: 'Grow something at a manageable scale', quickGoalSuffixes: ['choose-plant', 'prepare-space'] },
      { id: 'adapt', label: 'Make tending more accessible', goalTitle: 'Adapt plant care to my access and capacity', quickGoalSuffixes: ['adapt-task', 'ask-help'] },
    ],
    quickGoals: [
      { suffix: 'check-one', title: 'Check one plant without assuming it needs action' }, { suffix: 'choose-routine', title: 'Choose one realistic plant-care cue' },
      { suffix: 'identify-need', title: 'Identify one visible plant need or change' }, { suffix: 'reliable-source', title: 'Check one reliable care source' },
      { suffix: 'choose-plant', title: 'Choose one plant or growing idea suited to my space' }, { suffix: 'prepare-space', title: 'Prepare one small growing space or container' },
      { suffix: 'adapt-task', title: 'Make one tending task smaller or more accessible' }, { suffix: 'ask-help', title: 'Ask for help with one unsuitable care task' },
    ],
  },
  {
    familyId: 'fernip', journeyId: 'fernip-woodland-connection', title: 'Under the canopy', subject: 'woodland encounters', companionName: 'Fernip', focusName: 'woodland connection', momentName: 'woodland moment',
    introduction: 'Explore woods, forests, and tree-covered paths through safe, accessible visits or nearby observation. Distance, weather, mobility, transport, and daylight can change the form.',
    firstPrompt: 'What draws you towards woodland places?', firstHelperText: 'Choose what you value, including a brief or supported visit.', values: ['Tree cover and atmosphere', 'Paths and small discoveries', 'Plants, fungi, or wildlife', 'A change in attention', 'Returning through the seasons'],
    secondPrompt: 'What most shapes whether woodland time is possible?', secondHelperText: 'Safety and access take priority over completing a Focus.', barriers: ['Distance or transport', 'Mobility or trail access', 'Weather, daylight, or personal safety', 'Time or caring duties', 'Sensory load, allergies, or health needs'],
    moments: ['A woodland visit', 'A tree-covered local path', 'A view or observation from an accessible place', 'Planning or learning about a route', 'No woodland moment'], supports: ['A known safe route', 'Accessible path information', 'Suitable weather and daylight', 'Supportive company or solitude', 'Permission to turn back'], details: ['A path or landmark', 'Tree, leaf, bark, or root', 'Sound or light beneath cover', 'Wildlife, fungi, or ground life', 'A seasonal change'],
    directions: [
      { id: 'notice', label: 'Notice woodland life', goalTitle: 'Build an attentive woodland practice', quickGoalSuffixes: ['one-detail', 'tree-nearby'] },
      { id: 'return', label: 'Return to one safe place', goalTitle: 'Return to an accessible woodland place', quickGoalSuffixes: ['choose-route', 'check-access'] },
      { id: 'learn', label: 'Learn the woodland', goalTitle: 'Learn one woodland pattern at a time', quickGoalSuffixes: ['identify-one', 'season-note'] },
      { id: 'access', label: 'Find an accessible form', goalTitle: 'Find woodland connection that fits my access', quickGoalSuffixes: ['remote-route', 'supported-visit'] },
    ],
    quickGoals: [
      { suffix: 'one-detail', title: 'Notice one woodland detail' }, { suffix: 'tree-nearby', title: 'Spend a moment with tree cover already nearby' },
      { suffix: 'choose-route', title: 'Choose one woodland route I may want to return to' }, { suffix: 'check-access', title: 'Check route, access, weather, and daylight before visiting' },
      { suffix: 'identify-one', title: 'Learn one reliable detail about woodland life' }, { suffix: 'season-note', title: 'Keep one seasonal woodland change' },
      { suffix: 'remote-route', title: 'Explore a woodland route remotely without committing to travel' }, { suffix: 'supported-visit', title: 'Plan support for one woodland visit if useful' },
    ],
  },
  {
    familyId: 'amberleaf', journeyId: 'amberleaf-autumn-turning', title: 'The turning season', subject: 'autumn change and rituals', companionName: 'Amberleaf', focusName: 'autumn noticing', momentName: 'autumn moment',
    introduction: 'Notice autumn through light, colour, weather, routines, memory, and preparation. The season may feel beautiful, difficult, neutral, or unavailable where you live.',
    firstPrompt: 'What part of autumn would you like to notice?', firstHelperText: 'Choose what is present in your climate and life.', values: ['Colour and falling leaves', 'Changing light or temperature', 'Seasonal food or routines', 'Preparing for darker or colder days', 'How the season affects me'],
    secondPrompt: 'What makes seasonal change easier or harder to meet?', secondHelperText: 'Climate, grief, mood, health, access, and cultural meaning can all shape autumn.', barriers: ['The season is subtle or different here', 'Weather, darkness, or safety', 'Health, energy, or mood', 'Access to outdoor places', 'The season carries difficult feelings'],
    moments: ['A visible seasonal change', 'A seasonal routine or comfort', 'A practical preparation', 'An indoor or remembered autumn detail', 'No autumn moment'], supports: ['A familiar seasonal cue', 'Suitable light and weather', 'A comforting routine', 'Practical preparation', 'Permission for mixed feelings'], details: ['Colour or leaf change', 'Light or temperature', 'Sound, smell, or texture', 'A routine returning', 'A feeling or memory'],
    directions: [
      { id: 'notice', label: 'Notice the season turning', goalTitle: 'Notice autumn change where I am', quickGoalSuffixes: ['one-change', 'indoor-season'] },
      { id: 'ritual', label: 'Keep one seasonal ritual', goalTitle: 'Build one autumn ritual that fits', quickGoalSuffixes: ['choose-ritual', 'comfort-detail'] },
      { id: 'prepare', label: 'Prepare gently', goalTitle: 'Make seasonal change easier to live with', quickGoalSuffixes: ['one-preparation', 'light-plan'] },
      { id: 'feelings', label: 'Make room for mixed feelings', goalTitle: 'Meet autumn without forcing a mood', quickGoalSuffixes: ['name-effect', 'choose-support'] },
    ],
    quickGoals: [
      { suffix: 'one-change', title: 'Notice one real autumn change' }, { suffix: 'indoor-season', title: 'Notice the season from indoors if that fits better' },
      { suffix: 'choose-ritual', title: 'Choose one small autumn ritual' }, { suffix: 'comfort-detail', title: 'Prepare one seasonal comfort' },
      { suffix: 'one-preparation', title: 'Complete one useful seasonal preparation' }, { suffix: 'light-plan', title: 'Choose one support for darker days' },
      { suffix: 'name-effect', title: 'Name one honest effect the season has on me' }, { suffix: 'choose-support', title: 'Choose appropriate support if the season feels difficult' },
    ],
  },
  {
    familyId: 'blossle', journeyId: 'blossle-spring-return', title: 'Signs of return', subject: 'spring and blossom noticing', companionName: 'Blossle', focusName: 'spring noticing', momentName: 'spring moment',
    introduction: 'Notice spring through blossom, light, sound, growth, and returning routines. Spring does not need to feel hopeful, and blossom may be inaccessible or absent where you are.',
    firstPrompt: 'What part of spring would you like to follow?', firstHelperText: 'Choose a sign available in your climate or daily life.', values: ['Blossom or flowering trees', 'New leaves and growth', 'Changing light or weather', 'Birdsong or returning activity', 'How the season affects me'],
    secondPrompt: 'What shapes whether spring noticing fits?', secondHelperText: 'Allergies, mobility, weather, geography, time, and difficult feelings are valid conditions.', barriers: ['Allergies or health needs', 'Outdoor access or mobility', 'Weather or safety', 'Spring looks different here', 'The season does not feel positive'],
    moments: ['Blossom or flowers', 'New leaves or growth', 'A returning sound or activity', 'An indoor or distant spring view', 'No spring moment'], supports: ['A nearby view or plant', 'Suitable weather and access', 'Returning to a familiar place', 'A short sensory pause', 'Permission for a neutral response'], details: ['Petal, bud, or leaf', 'Light or colour', 'Sound or animal activity', 'Timing of a return', 'A feeling or memory'],
    directions: [
      { id: 'notice', label: 'Notice signs of return', goalTitle: 'Notice spring returning where I am', quickGoalSuffixes: ['one-sign', 'window-sign'] },
      { id: 'blossom', label: 'Follow blossom safely', goalTitle: 'Follow accessible blossom through the season', quickGoalSuffixes: ['find-blossom', 'check-allergy'] },
      { id: 'return', label: 'Return to one place', goalTitle: 'Return to a spring place and notice change', quickGoalSuffixes: ['choose-place', 'return-detail'] },
      { id: 'feelings', label: 'Notice my response honestly', goalTitle: 'Meet spring without forcing renewal', quickGoalSuffixes: ['name-response', 'choose-kindness'] },
    ],
    quickGoals: [
      { suffix: 'one-sign', title: 'Notice one real sign of spring' }, { suffix: 'window-sign', title: 'Notice spring from indoors or nearby' },
      { suffix: 'find-blossom', title: 'Find one accessible blossom view without needing to travel' }, { suffix: 'check-allergy', title: 'Choose an allergy-aware way to notice spring' },
      { suffix: 'choose-place', title: 'Choose one place or view to revisit' }, { suffix: 'return-detail', title: 'Keep one change on a return visit' },
      { suffix: 'name-response', title: 'Name one honest response to the season' }, { suffix: 'choose-kindness', title: 'Choose one kind adjustment if spring feels difficult' },
    ],
  },
  {
    familyId: 'peakle', journeyId: 'peakle-hiking-confidence', title: 'A realistic ascent', subject: 'hills, hikes, and viewpoints', companionName: 'Peakle', focusName: 'hiking', momentName: 'hill or trail moment',
    introduction: 'Build hiking confidence around real access, preparation, weather, health, route difficulty, and support. A lower viewpoint, adapted route, turning back, or not hiking can be the right result.',
    firstPrompt: 'What would you like from hills or hikes?', firstHelperText: 'Choose the experience, not the height or distance.', values: ['Time on a trail', 'A wider view', 'Confidence on ascent', 'A chosen physical challenge', 'Connection to landscape'],
    secondPrompt: 'What most shapes the route that fits?', secondHelperText: 'Route grades, mobility, symptoms, weather, transport, equipment, and company all matter.', barriers: ['Health, pain, mobility, or energy', 'Route difficulty or access information', 'Weather, daylight, or safety', 'Transport, equipment, or cost', 'Confidence or suitable company'],
    moments: ['A hill or hike', 'A lower or accessible viewpoint', 'Route preparation', 'An adapted or supported trail moment', 'No hiking moment'], supports: ['Clear route and access information', 'Suitable pace and rest', 'Weather and safety planning', 'Appropriate equipment or support', 'Permission to turn back'], details: ['Gradient or terrain', 'Pace or body response', 'A rest or route choice', 'The view or landscape', 'A preparation lesson'],
    directions: [
      { id: 'route', label: 'Find routes that fit', goalTitle: 'Find hill and trail routes that fit my access', quickGoalSuffixes: ['research-route', 'check-conditions'] },
      { id: 'pace', label: 'Learn my climbing pace', goalTitle: 'Learn a sustainable pace for ascent', quickGoalSuffixes: ['choose-pace', 'plan-rest'] },
      { id: 'view', label: 'Reach realistic viewpoints', goalTitle: 'Reach viewpoints that suit my current capacity', quickGoalSuffixes: ['choose-view', 'access-option'] },
      { id: 'prepare', label: 'Prepare safely', goalTitle: 'Build a safer hiking preparation rhythm', quickGoalSuffixes: ['kit-check', 'turnaround-plan'] },
    ],
    quickGoals: [
      { suffix: 'research-route', title: 'Check one route’s distance, gradient, surface, and access' }, { suffix: 'check-conditions', title: 'Check weather, daylight, and current conditions' },
      { suffix: 'choose-pace', title: 'Choose a pace that allows me to respond to my body' }, { suffix: 'plan-rest', title: 'Plan one rest or recovery option' },
      { suffix: 'choose-view', title: 'Choose one realistic viewpoint without committing to reach it' }, { suffix: 'access-option', title: 'Find a lower, supported, or accessible viewpoint option' },
      { suffix: 'kit-check', title: 'Check one relevant safety or comfort item' }, { suffix: 'turnaround-plan', title: 'Choose a turnaround condition before setting out' },
    ],
  },
  {
    familyId: 'stillo', journeyId: 'stillo-still-water', title: 'Still-water pauses', subject: 'quiet moments beside still water', companionName: 'Stillo', focusName: 'still-water reflection', momentName: 'still-water moment',
    introduction: 'Explore ponds, lakes, reservoirs, canals, reflections, or distant views through safe pauses. Quiet is optional; company, movement, noise, and no emotional change can all be part of the moment.',
    firstPrompt: 'What do you value in still-water places?', firstHelperText: 'Choose the experience without assuming it must calm or clarify you.', values: ['Reflection and light', 'Wildlife and small movement', 'A slower pace', 'A familiar place to return to', 'Space for thoughts or company'],
    secondPrompt: 'What shapes whether a still-water pause fits?', secondHelperText: 'Safety, access, weather, crowds, distance, and whether quiet feels supportive all matter.', barriers: ['Distance or transport', 'Mobility or route access', 'Weather, water-edge, or personal safety', 'Crowds or sensory conditions', 'Quiet does not feel supportive'],
    moments: ['A pond or lake visit', 'A canal or reservoir pause', 'An indoor or distant water view', 'Wildlife or reflection noticing', 'No still-water moment'], supports: ['A safe accessible position', 'Suitable weather and light', 'The right company or solitude', 'A familiar place', 'Permission to leave or keep moving'], details: ['Reflection or ripple', 'Light or colour', 'Sound or wildlife', 'A thought or feeling', 'What changed on return'],
    directions: [
      { id: 'pause', label: 'Create safe pauses', goalTitle: 'Make room for safe still-water pauses', quickGoalSuffixes: ['find-safe-view', 'brief-water-pause'] },
      { id: 'notice', label: 'Look more closely', goalTitle: 'Notice still-water places with attention', quickGoalSuffixes: ['surface-detail', 'wildlife-detail'] },
      { id: 'return', label: 'Return to one place', goalTitle: 'Return to a suitable still-water place', quickGoalSuffixes: ['choose-return', 'check-access'] },
      { id: 'adapt', label: 'Find another form of stillness', goalTitle: 'Find reflective moments that fit my needs', quickGoalSuffixes: ['indoor-view', 'moving-pause'] },
    ],
    quickGoals: [
      { suffix: 'find-safe-view', title: 'Find one safe still-water view already available' }, { suffix: 'brief-water-pause', title: 'Take one brief pause near or overlooking still water' },
      { suffix: 'surface-detail', title: 'Notice one reflection, ripple, light, or surface detail' }, { suffix: 'wildlife-detail', title: 'Notice wildlife without approaching or disturbing it' },
      { suffix: 'choose-return', title: 'Choose one suitable place I may return to' }, { suffix: 'check-access', title: 'Check route, edge safety, weather, and access' },
      { suffix: 'indoor-view', title: 'Use an indoor or distant water view' }, { suffix: 'moving-pause', title: 'Keep moving or bring company if stillness feels unhelpful' },
    ],
  },
  {
    familyId: 'drizzlet', journeyId: 'drizzlet-rainy-days', title: 'Life with rain', subject: 'rainy-day noticing and adaptation', companionName: 'Drizzlet', focusName: 'rainy-day life', momentName: 'rain moment',
    introduction: 'Notice how rain changes sound, light, plans, comfort, and movement. Staying indoors, changing plans, using access support, or disliking rain are all valid.',
    firstPrompt: 'What would you like to notice about rainy days?', firstHelperText: 'Choose what is relevant to your real routines and climate.', values: ['Sound, light, and surfaces', 'How plans change', 'Comfort and shelter', 'A suitable rainy outing', 'How rain affects my mood or body'],
    secondPrompt: 'What makes rain easier or harder to meet?', secondHelperText: 'Flooding, lightning, visibility, mobility, pain, transport, clothing, and caring duties can all change the safe choice.', barriers: ['Unsafe or severe conditions', 'Mobility, pain, or health needs', 'Transport or route access', 'Clothing, shelter, or cost', 'Low mood, energy, or changed plans'],
    moments: ['Rain noticed from indoors', 'A necessary journey in rain', 'A chosen safe rain outing', 'A changed plan or comfort ritual', 'No rain moment'], supports: ['Safe shelter', 'Suitable clothing or equipment', 'Flexible plans', 'Accessible transport or routes', 'Permission to stay in'], details: ['Sound', 'Reflections or light', 'Smell or air', 'Water on a surface', 'A change to the day'],
    directions: [
      { id: 'notice', label: 'Notice rain closely', goalTitle: 'Build an attentive rainy-day practice', quickGoalSuffixes: ['one-rain-detail', 'window-rain'] },
      { id: 'adapt', label: 'Adapt plans kindly', goalTitle: 'Make rainy days easier to navigate', quickGoalSuffixes: ['plan-alternative', 'prepare-rain'] },
      { id: 'comfort', label: 'Create a rain ritual', goalTitle: 'Build one supportive rainy-day ritual', quickGoalSuffixes: ['choose-comfort', 'rain-sound'] },
      { id: 'outside', label: 'Use safe outdoor moments', goalTitle: 'Choose safe rain outings when they fit', quickGoalSuffixes: ['check-weather', 'short-safe-route'] },
    ],
    quickGoals: [
      { suffix: 'one-rain-detail', title: 'Notice one real rain detail' }, { suffix: 'window-rain', title: 'Notice rain from safe shelter or indoors' },
      { suffix: 'plan-alternative', title: 'Choose one accessible alternative for a rain-affected plan' }, { suffix: 'prepare-rain', title: 'Prepare one useful rain item or transport option' },
      { suffix: 'choose-comfort', title: 'Choose one supportive rainy-day comfort' }, { suffix: 'rain-sound', title: 'Listen to real rain briefly if the sound suits me' },
      { suffix: 'check-weather', title: 'Check current weather and safety information before going out' }, { suffix: 'short-safe-route', title: 'Use one short safe route in rain only if conditions fit' },
    ],
  },
  {
    familyId: 'driftkin', journeyId: 'driftkin-snow-days', title: 'Changed by snow', subject: 'snow, frost, and winter change', companionName: 'Driftkin', focusName: 'snow-day noticing', momentName: 'snow or frost moment',
    introduction: 'Notice snow and frost through transformed places, light, quiet, warmth, and practical choices. Staying inside and prioritising safety, warmth, mobility, and essential needs always count.',
    firstPrompt: 'What would you like to notice about snow or frost?', firstHelperText: 'Choose what is available in your climate; no snowfall is useful information too.', values: ['A familiar place transformed', 'Light, texture, or sound', 'Tracks and small traces', 'Warmth and winter routines', 'How plans and movement change'],
    secondPrompt: 'What most shapes the safe winter choice?', secondHelperText: 'Ice, cold exposure, mobility, transport, power, housing, caring duties, and health needs take priority.', barriers: ['Ice, severe cold, or unsafe weather', 'Mobility, pain, or health needs', 'Transport or route disruption', 'Warmth, housing, or equipment needs', 'Snow is rare or absent here'],
    moments: ['Snowfall or settling snow', 'Frost or ice noticed safely', 'A transformed view from indoors', 'A warmth or practical winter choice', 'No snow or frost moment'], supports: ['Reliable weather information', 'Warmth and safe shelter', 'Accessible cleared routes or transport', 'Suitable clothing or support', 'Permission to change plans'], details: ['A changed surface', 'Light or colour', 'Sound or quiet', 'A track or trace', 'A practical effect'],
    directions: [
      { id: 'notice', label: 'Notice winter change', goalTitle: 'Notice snow or frost safely where I am', quickGoalSuffixes: ['safe-detail', 'window-view'] },
      { id: 'prepare', label: 'Make winter days workable', goalTitle: 'Prepare gently for snow and frost', quickGoalSuffixes: ['weather-check', 'warmth-check'] },
      { id: 'ritual', label: 'Keep a winter ritual', goalTitle: 'Build one supportive snow-day or frost-day ritual', quickGoalSuffixes: ['choose-ritual', 'keep-change'] },
      { id: 'access', label: 'Protect access and safety', goalTitle: 'Make safe access the priority in winter conditions', quickGoalSuffixes: ['route-option', 'ask-support'] },
    ],
    quickGoals: [
      { suffix: 'safe-detail', title: 'Notice one snow or frost detail from a safe position' }, { suffix: 'window-view', title: 'Notice a changed place from indoors' },
      { suffix: 'weather-check', title: 'Check current weather, ice, and travel information' }, { suffix: 'warmth-check', title: 'Check one warmth or essential practical need' },
      { suffix: 'choose-ritual', title: 'Choose one supportive winter ritual' }, { suffix: 'keep-change', title: 'Keep one detail about how a familiar place changed' },
      { suffix: 'route-option', title: 'Choose a safer accessible route or stay in when needed' }, { suffix: 'ask-support', title: 'Ask for support with one unsafe winter task' },
    ],
  },
] as const satisfies readonly CompactSpecialistCompanionSystemConfig[];

export const BATCH_NINE_SPECIALIST_SYSTEMS = configs.map(createCompactSpecialistCompanionSystem);
export const BATCH_NINE_COMPANION_CONTENT = Object.fromEntries(BATCH_NINE_SPECIALIST_SYSTEMS.map((system) => [system.familyId, system.content]));
export const BATCH_NINE_SPECIALIST_JOURNEY_IDS = new Map(BATCH_NINE_SPECIALIST_SYSTEMS.map((system) => [system.familyId, system.journeyId]));

