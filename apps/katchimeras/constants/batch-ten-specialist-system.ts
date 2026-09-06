import {
  createCompactSpecialistCompanionSystem,
  type CompactSpecialistCompanionSystemConfig,
} from '@/constants/specialist-companion-system';

const configs = [
  {
    familyId: 'duskle', journeyId: 'duskle-evening-light', title: 'The day in changing light', subject: 'sunset, dusk, and evening light', companionName: 'Duskle', focusName: 'evening-light noticing', momentName: 'dusk moment',
    introduction: 'Notice sunset and dusk from a safe, accessible place when you are naturally awake. Cloud, city light, an indoor view, or no visible sunset can all belong; you never need to travel or wait outside.',
    firstPrompt: 'What interests you about the change into evening?', firstHelperText: 'Choose the experience rather than the most dramatic view.', values: ['Colour and changing light', 'The feeling of a threshold', 'A pause at the end of the day', 'How familiar places transform', 'Finding a view worth returning to'],
    secondPrompt: 'What shapes whether a dusk moment fits?', secondHelperText: 'Season, cloud, work, caring duties, safety, mobility, and access all matter.', barriers: ['Timing, work, or caring duties', 'Weather or cloud', 'Mobility, route, or view access', 'Darkness or personal safety', 'Dusk does not feel supportive'],
    moments: ['A visible sunset', 'Cloud or colour at dusk', 'An indoor or city-light view', 'A brief evening transition', 'No dusk moment'], supports: ['A safe familiar view', 'A window or nearby position', 'Suitable weather and timing', 'A short pause', 'The right company or solitude'], details: ['Colour or cloud', 'Light on a surface', 'The horizon or shadows', 'Sound as the day changed', 'A shift in pace or feeling'],
    directions: [
      { id: 'notice', label: 'Notice evening light', goalTitle: 'Build an attentive dusk practice', quickGoalSuffixes: ['one-light-detail', 'window-dusk'] },
      { id: 'pause', label: 'Use dusk as a pause', goalTitle: 'Make room for a brief evening-light pause', quickGoalSuffixes: ['brief-pause', 'end-cue'] },
      { id: 'place', label: 'Return to one view', goalTitle: 'Return safely to a meaningful dusk view', quickGoalSuffixes: ['choose-view', 'check-timing'] },
      { id: 'adapt', label: 'Find accessible evening light', goalTitle: 'Find dusk moments that fit my access and schedule', quickGoalSuffixes: ['nearby-light', 'cloud-counts'] },
    ],
    quickGoals: [
      { suffix: 'one-light-detail', title: 'Notice one real dusk-light detail' }, { suffix: 'window-dusk', title: 'Notice dusk from indoors or nearby' },
      { suffix: 'brief-pause', title: 'Pause briefly as the light changes if it fits' }, { suffix: 'end-cue', title: 'Use one evening-light moment as a gentle transition cue' },
      { suffix: 'choose-view', title: 'Choose one safe view I may return to' }, { suffix: 'check-timing', title: 'Check timing, weather, access, and safety before going anywhere' },
      { suffix: 'nearby-light', title: 'Notice evening light on one familiar surface' }, { suffix: 'cloud-counts', title: 'Keep one cloud, shadow, or city-light detail when sunset is hidden' },
    ],
  },
  {
    familyId: 'twinklet', journeyId: 'twinklet-night-sky', title: 'A patient sky', subject: 'night-sky observation', companionName: 'Twinklet', focusName: 'night-sky observation', momentName: 'sky-watching moment',
    introduction: 'Build a relationship with the moon, stars, planets, and changing sky only when you are already awake and can observe safely. Indoor views, bright skies, cloud, and remote tools all count.',
    firstPrompt: 'What would you like to find in the night sky?', firstHelperText: 'You do not need equipment or specialist knowledge.', values: ['The moon and its changes', 'Stars or constellations', 'Planets or moving lights', 'Scale and wonder', 'A reason to look patiently'],
    secondPrompt: 'What most affects whether sky-watching is possible?', secondHelperText: 'Sleep, safety, weather, light pollution, mobility, and access come before the Focus.', barriers: ['I am not naturally awake then', 'Cloud or weather', 'Light pollution or blocked views', 'Outdoor access or personal safety', 'I do not know what I am seeing'],
    moments: ['Moon observation', 'Stars or constellation', 'Planet or moving object', 'Indoor, urban, or remote sky view', 'No sky moment'], supports: ['A safe familiar view', 'Clear timing information', 'A simple sky guide', 'Patience with bright or cloudy skies', 'Warmth and suitable access'], details: ['Moon shape or position', 'A star pattern', 'Direction or movement', 'Cloud, colour, or visibility', 'A question to investigate'],
    directions: [
      { id: 'look', label: 'Look when it naturally fits', goalTitle: 'Build a safe night-sky noticing rhythm', quickGoalSuffixes: ['safe-look', 'window-sky'] },
      { id: 'learn', label: 'Learn one sky pattern', goalTitle: 'Learn one night-sky pattern at a time', quickGoalSuffixes: ['identify-one', 'check-source'] },
      { id: 'moon', label: 'Follow the moon', goalTitle: 'Follow the moon without changing my sleep', quickGoalSuffixes: ['moon-check', 'moon-detail'] },
      { id: 'access', label: 'Use accessible tools', goalTitle: 'Find accessible ways to explore the night sky', quickGoalSuffixes: ['sky-tool', 'daytime-plan'] },
    ],
    quickGoals: [
      { suffix: 'safe-look', title: 'Look at the sky briefly only if I am already awake and safe' }, { suffix: 'window-sky', title: 'Use an indoor or familiar safe view' },
      { suffix: 'identify-one', title: 'Investigate one real sky object or pattern' }, { suffix: 'check-source', title: 'Check one sky identification with a reliable source' },
      { suffix: 'moon-check', title: 'Check the moon phase without staying up for it' }, { suffix: 'moon-detail', title: 'Notice one moon position, shape, colour, or cloud detail' },
      { suffix: 'sky-tool', title: 'Use one accessible sky map or remote observatory tool' }, { suffix: 'daytime-plan', title: 'Plan a future sky look during the day without committing to it' },
    ],
  },
  {
    familyId: 'tempesto', journeyId: 'tempesto-storm-awareness', title: 'Storm-aware', subject: 'storm safety and observation', companionName: 'Tempesto', focusName: 'storm awareness', momentName: 'storm moment',
    introduction: 'Notice storms only from appropriate shelter while following official alerts and local safety guidance. This Focus never asks you to approach lightning, floodwater, high wind, debris, or another hazard.',
    firstPrompt: 'What would be useful to understand about storms?', firstHelperText: 'Safety and preparation come before atmosphere or curiosity.', values: ['Early signs and official alerts', 'How the atmosphere changes', 'A practical preparation routine', 'How my household responds', 'The before-and-after pattern'],
    secondPrompt: 'What most shapes what you need during severe weather?', secondHelperText: 'Local hazards, housing, disability, utilities, caring duties, trauma, and emergency guidance can all change the plan.', barriers: ['Lightning, flood, wind, fire, or other local hazard', 'Housing, power, or essential-resource needs', 'Disability, health, or access needs', 'Caring duties or animal safety', 'Storms cause distress or traumatic reactions'],
    moments: ['An official alert or forecast change', 'A safely observed storm detail', 'A practical preparation', 'A before-and-after change', 'No storm moment'], supports: ['Official local information', 'Safe shelter', 'A simple household plan', 'Charged or available essentials', 'Human support'], details: ['Cloud, light, or pressure change', 'Thunder, wind, or rain from shelter', 'An alert or timing detail', 'A practical safety action', 'The atmosphere afterward'],
    directions: [
      { id: 'prepare', label: 'Prepare for local hazards', goalTitle: 'Build a practical severe-weather preparation rhythm', quickGoalSuffixes: ['official-source', 'one-essential'] },
      { id: 'signals', label: 'Understand storm signals', goalTitle: 'Learn storm signals without unsafe exposure', quickGoalSuffixes: ['alert-setting', 'safe-detail'] },
      { id: 'household', label: 'Clarify a household plan', goalTitle: 'Clarify how my household responds to storms', quickGoalSuffixes: ['safe-place', 'contact-plan'] },
      { id: 'support', label: 'Reduce storm distress', goalTitle: 'Use suitable support during storms', quickGoalSuffixes: ['reduce-input', 'trusted-support'] },
    ],
    quickGoals: [
      { suffix: 'official-source', title: 'Identify one official local weather or emergency source' }, { suffix: 'one-essential', title: 'Check one relevant essential without panic-buying' },
      { suffix: 'alert-setting', title: 'Check one appropriate severe-weather alert setting' }, { suffix: 'safe-detail', title: 'Notice one storm detail only from appropriate shelter' },
      { suffix: 'safe-place', title: 'Identify the appropriate safer place for one local hazard' }, { suffix: 'contact-plan', title: 'Clarify one contact or caring step for severe weather' },
      { suffix: 'reduce-input', title: 'Reduce unnecessary storm media if it increases distress' }, { suffix: 'trusted-support', title: 'Choose one trusted person or service for storm support' },
    ],
  },
  {
    familyId: 'mistle', journeyId: 'mistle-fog-awareness', title: 'Half-seen places', subject: 'fog, mist, and low visibility', companionName: 'Mistle', focusName: 'fog noticing', momentName: 'fog or mist moment',
    introduction: 'Notice how fog changes distance, sound, light, and familiar places while treating low visibility as a safety condition. Indoor observation and changing or cancelling travel count.',
    firstPrompt: 'What interests you about fog or mist?', firstHelperText: 'Choose what you can notice safely.', values: ['How distance changes', 'Sound and quiet', 'Light and softened colour', 'A familiar place transformed', 'Moving carefully through uncertainty'],
    secondPrompt: 'What most shapes the safe choice in low visibility?', secondHelperText: 'Driving, cycling, walking, respiratory needs, temperature, and route familiarity all matter.', barriers: ['Road or travel safety', 'Walking, cycling, or route visibility', 'Respiratory, temperature, or health needs', 'Unfamiliar surroundings', 'Fog is rare or absent here'],
    moments: ['Fog viewed from indoors', 'A familiar place in mist', 'A necessary journey adapted safely', 'A changed or cancelled plan', 'No fog moment'], supports: ['Reliable visibility and travel information', 'A familiar safe position', 'Slower timing or a changed route', 'Suitable lights, clothing, or support', 'Permission not to travel'], details: ['Visibility distance', 'A softened light or colour', 'Sound', 'Moisture or temperature', 'What disappeared or stood out'],
    directions: [
      { id: 'notice', label: 'Notice fog safely', goalTitle: 'Build a safe fog-noticing practice', quickGoalSuffixes: ['indoor-detail', 'visibility-detail'] },
      { id: 'familiar', label: 'Follow familiar places changing', goalTitle: 'Notice how fog transforms familiar places', quickGoalSuffixes: ['known-view', 'compare-clear'] },
      { id: 'travel', label: 'Adapt low-visibility travel', goalTitle: 'Make safer choices in low visibility', quickGoalSuffixes: ['check-visibility', 'change-plan'] },
      { id: 'learn', label: 'Understand the atmosphere', goalTitle: 'Learn how fog and mist form where I live', quickGoalSuffixes: ['learn-fog', 'weather-note'] },
    ],
    quickGoals: [
      { suffix: 'indoor-detail', title: 'Notice fog from safe shelter or indoors' }, { suffix: 'visibility-detail', title: 'Keep one visibility, light, sound, or moisture detail' },
      { suffix: 'known-view', title: 'Compare one familiar view in fog' }, { suffix: 'compare-clear', title: 'Notice what is hidden or emphasised compared with clear weather' },
      { suffix: 'check-visibility', title: 'Check official visibility and travel information before a journey' }, { suffix: 'change-plan', title: 'Slow, reroute, delay, or cancel travel when needed' },
      { suffix: 'learn-fog', title: 'Learn one reliable fact about local fog or mist' }, { suffix: 'weather-note', title: 'Keep one condition linked to a foggy moment' },
    ],
  },
  {
    familyId: 'voyagle', journeyId: 'voyagle-travel-stories', title: 'Travel with a purpose', subject: 'trips and unfamiliar destinations', companionName: 'Voyagle', focusName: 'travel', momentName: 'travel moment',
    introduction: 'Shape trips around curiosity, rest, connection, access, and what you want to remember. Planning, local days away, supported travel, changed plans, and deciding not to travel can all be meaningful.',
    firstPrompt: 'What would you like a trip to give you?', firstHelperText: 'Choose the experience, not distance, expense, or status.', values: ['Discovery and difference', 'Rest or a change of pace', 'Connection with people', 'A particular place or interest', 'A story or memory to keep'],
    secondPrompt: 'What most shapes the travel that fits?', secondHelperText: 'Money, documents, disability, health, safety, caring duties, culture, and environmental concerns are real constraints.', barriers: ['Cost or time', 'Disability, health, or access needs', 'Safety, documents, or uncertainty', 'Caring duties or other responsibilities', 'Travel itself is stressful or unwanted'],
    moments: ['Planning or imagining a trip', 'A local day away', 'A longer unfamiliar trip', 'A changed, shortened, or supported journey', 'No travel moment'], supports: ['A clear purpose', 'Reliable access and safety information', 'A workable budget and pace', 'Suitable support or company', 'Flexibility to change plans'], details: ['A place-specific sensory detail', 'A route or orientation detail', 'A local custom, food, or context', 'A human interaction with privacy respected', 'How leaving or returning felt'],
    directions: [
      { id: 'plan', label: 'Plan a realistic trip', goalTitle: 'Plan travel around my real needs and purpose', quickGoalSuffixes: ['name-purpose', 'check-one-constraint'] },
      { id: 'discover', label: 'Notice place-specific details', goalTitle: 'Travel with attention to place and context', quickGoalSuffixes: ['one-local-detail', 'reliable-context'] },
      { id: 'access', label: 'Make travel more accessible', goalTitle: 'Build an accessible and flexible travel approach', quickGoalSuffixes: ['access-check', 'backup-option'] },
      { id: 'remember', label: 'Keep travel meaningfully', goalTitle: 'Keep travel memories without collecting everything', quickGoalSuffixes: ['one-memory', 'return-note'] },
    ],
    quickGoals: [
      { suffix: 'name-purpose', title: 'Name what I would actually want from one trip' }, { suffix: 'check-one-constraint', title: 'Check one cost, timing, document, safety, or responsibility constraint' },
      { suffix: 'one-local-detail', title: 'Keep one place-specific detail from a real day away' }, { suffix: 'reliable-context', title: 'Learn one reliable and respectful local context detail' },
      { suffix: 'access-check', title: 'Check one route, venue, accommodation, or transport access need' }, { suffix: 'backup-option', title: 'Choose one flexible backup, rest, or cancellation option' },
      { suffix: 'one-memory', title: 'Keep one travel memory rather than everything' }, { suffix: 'return-note', title: 'Notice one effect of leaving or returning home' },
    ],
  },
  {
    familyId: 'ironette', journeyId: 'ironette-landmark-context', title: 'Beyond the postcard', subject: 'landmarks, architecture, and built history', companionName: 'Ironette', focusName: 'landmark encounters', momentName: 'built-place moment',
    introduction: 'Explore landmarks through structure, scale, use, history, contested meaning, and personal response. Nearby buildings, accessible viewpoints, photographs, and reliable digital archives can count.',
    firstPrompt: 'What makes a landmark interesting to you?', firstHelperText: 'Fame is only one possible reason.', values: ['Structure and engineering', 'Materials and visual detail', 'History and changing use', 'Human scale and public life', 'The stories a landmark leaves out'],
    secondPrompt: 'What most affects whether landmark exploration fits?', secondHelperText: 'Travel, cost, physical access, crowds, disputed histories, and reliable information all matter.', barriers: ['Distance, cost, or opening access', 'Mobility or sensory access', 'Crowds or personal safety', 'Unclear or promotional history', 'The place carries difficult or contested meaning'],
    moments: ['A landmark visited in person', 'A notable nearby building', 'A distant or accessible view', 'A photograph, model, or digital archive', 'No landmark moment'], supports: ['Clear access information', 'Time to look beyond the main view', 'Reliable historical sources', 'Multiple perspectives', 'Permission for a critical response'], details: ['Structure or engineering', 'Material or surface', 'Scale or spatial relation', 'Evidence of use or change', 'A history or missing perspective'],
    directions: [
      { id: 'look', label: 'Look beyond the main image', goalTitle: 'Notice built places beyond the postcard view', quickGoalSuffixes: ['one-structure', 'human-detail'] },
      { id: 'history', label: 'Learn layered history', goalTitle: 'Learn the layered history of landmarks', quickGoalSuffixes: ['reliable-source', 'missing-view'] },
      { id: 'nearby', label: 'Explore nearby architecture', goalTitle: 'Build a local built-place practice', quickGoalSuffixes: ['nearby-building', 'change-angle'] },
      { id: 'access', label: 'Use accessible encounters', goalTitle: 'Find accessible ways to explore landmarks', quickGoalSuffixes: ['access-route', 'digital-landmark'] },
    ],
    quickGoals: [
      { suffix: 'one-structure', title: 'Notice one structural, material, or scale detail' }, { suffix: 'human-detail', title: 'Notice how people use or move around a built place' },
      { suffix: 'reliable-source', title: 'Check one landmark claim with a reliable source' }, { suffix: 'missing-view', title: 'Look for one perspective absent from the official story' },
      { suffix: 'nearby-building', title: 'Notice one notable building already nearby' }, { suffix: 'change-angle', title: 'View one built place from another safe angle' },
      { suffix: 'access-route', title: 'Check one access, crowd, route, or opening detail' }, { suffix: 'digital-landmark', title: 'Explore one landmark through an accessible digital archive' },
    ],
  },
  {
    familyId: 'neonpoko', journeyId: 'neonpoko-city-energy', title: 'Inside the city current', subject: 'bright, busy city places', companionName: 'Neonpoko', focusName: 'city-energy encounters', momentName: 'busy-city moment',
    introduction: 'Notice movement, light, density, and human choreography in busy urban places while respecting sensory limits, crowds, cost, safety, mobility, and the choice not to seek intensity.',
    firstPrompt: 'What interests you in a busy city place?', firstHelperText: 'Choose what draws your attention, not what should feel exciting.', values: ['Movement and timing', 'Light, signs, and reflections', 'People sharing limited space', 'A strong sense of place', 'The contrast between rush and pause'],
    secondPrompt: 'What most shapes whether city intensity fits?', secondHelperText: 'Crowds, noise, mobility, policing, harassment, expense, time, and sensory needs can change the safe choice.', barriers: ['Crowds or sensory load', 'Mobility or route access', 'Personal safety or harassment', 'Cost, transport, or distance', 'The intensity does not appeal to me'],
    moments: ['A busy crossing or street', 'Bright signs or night-city light', 'A quieter edge of a busy district', 'An indoor, distant, or passing view', 'No high-energy city moment'], supports: ['A clear route and exit', 'A quieter time or edge', 'Suitable company or solitude', 'Sensory or mobility support', 'Permission to leave quickly'], details: ['Movement or timing', 'Sign, colour, or reflection', 'Sound or rhythm', 'A pause inside the flow', 'How the energy affected me'],
    directions: [
      { id: 'notice', label: 'Read the city rhythm', goalTitle: 'Notice busy city places with attention', quickGoalSuffixes: ['one-city-detail', 'movement-pattern'] },
      { id: 'light', label: 'Follow urban light', goalTitle: 'Explore urban light without needing late-night travel', quickGoalSuffixes: ['light-detail', 'indoor-neon'] },
      { id: 'pause', label: 'Find space inside intensity', goalTitle: 'Find manageable pauses in busy city places', quickGoalSuffixes: ['choose-exit', 'quiet-edge'] },
      { id: 'access', label: 'Shape an accessible city encounter', goalTitle: 'Explore city energy around my access and safety needs', quickGoalSuffixes: ['route-check', 'lower-intensity'] },
    ],
    quickGoals: [
      { suffix: 'one-city-detail', title: 'Notice one real movement, sound, crowd, or timing detail' }, { suffix: 'movement-pattern', title: 'Watch one city movement pattern from a safe position' },
      { suffix: 'light-detail', title: 'Notice one sign, colour, reflection, or storefront detail' }, { suffix: 'indoor-neon', title: 'Notice urban light from indoors, transit, or an earlier hour' },
      { suffix: 'choose-exit', title: 'Choose an exit or stopping point before entering a busy area' }, { suffix: 'quiet-edge', title: 'Find one quieter edge or recovery option' },
      { suffix: 'route-check', title: 'Check one route, access, crowd, or safety condition' }, { suffix: 'lower-intensity', title: 'Choose a lower-intensity city encounter if that fits better' },
    ],
  },
  {
    familyId: 'skysette', journeyId: 'skysette-high-perspective', title: 'A wider view', subject: 'observatories and elevated viewpoints', companionName: 'Skysette', focusName: 'high-view encounters', momentName: 'viewpoint moment',
    introduction: 'Explore scale, horizon, orientation, and perspective through observatories and elevated views that suit your access and comfort. Remote views, lower viewpoints, and avoiding heights are valid.',
    firstPrompt: 'What would you like a wider view to give you?', firstHelperText: 'Choose the experience, not the greatest height.', values: ['Understanding how places connect', 'A horizon or sense of distance', 'A new view of somewhere familiar', 'Observatory learning', 'A shift in perspective'],
    secondPrompt: 'What shapes which viewpoint fits?', secondHelperText: 'Fear of heights, vertigo, mobility, cost, transport, weather, crowds, and opening access all matter.', barriers: ['Fear of heights, vertigo, or health needs', 'Mobility or building access', 'Cost, distance, or transport', 'Weather, visibility, or closure', 'Crowds or sensory conditions'],
    moments: ['An observatory visit', 'A high built viewpoint', 'A lower or accessible wide view', 'A remote camera, map, or panorama', 'No viewpoint moment'], supports: ['Clear access and height information', 'A lower or enclosed option', 'Suitable visibility and weather', 'Supportive company or solitude', 'Permission not to approach an edge'], details: ['Horizon or distance', 'A route or landmark relationship', 'Weather or visibility', 'Scale or layout', 'A thought that shifted'],
    directions: [
      { id: 'orient', label: 'Understand a place from above', goalTitle: 'Use wide views to understand how places connect', quickGoalSuffixes: ['find-bearing', 'map-compare'] },
      { id: 'view', label: 'Find suitable viewpoints', goalTitle: 'Find viewpoints that fit my access and comfort', quickGoalSuffixes: ['view-option', 'access-check'] },
      { id: 'observe', label: 'Explore observatories', goalTitle: 'Explore observatory views and learning', quickGoalSuffixes: ['observatory-option', 'one-sky-detail'] },
      { id: 'remote', label: 'Use remote perspective', goalTitle: 'Use accessible remote views to change perspective', quickGoalSuffixes: ['remote-view', 'one-pattern'] },
    ],
    quickGoals: [
      { suffix: 'find-bearing', title: 'Identify one direction, route, or landmark relationship' }, { suffix: 'map-compare', title: 'Compare one real view with a map' },
      { suffix: 'view-option', title: 'Find one lower, enclosed, or accessible viewpoint option' }, { suffix: 'access-check', title: 'Check height, access, weather, crowd, and closure information' },
      { suffix: 'observatory-option', title: 'Explore one observatory option without committing to visit' }, { suffix: 'one-sky-detail', title: 'Learn one reliable observatory, horizon, or sky detail' },
      { suffix: 'remote-view', title: 'Use one panorama, map, or remote camera view' }, { suffix: 'one-pattern', title: 'Notice one spatial pattern made visible by distance' },
    ],
  },
] as const satisfies readonly CompactSpecialistCompanionSystemConfig[];

export const BATCH_TEN_SPECIALIST_SYSTEMS = configs.map(createCompactSpecialistCompanionSystem);
export const BATCH_TEN_COMPANION_CONTENT = Object.fromEntries(BATCH_TEN_SPECIALIST_SYSTEMS.map((system) => [system.familyId, system.content]));
export const BATCH_TEN_SPECIALIST_JOURNEY_IDS = new Map(BATCH_TEN_SPECIALIST_SYSTEMS.map((system) => [system.familyId, system.journeyId]));

