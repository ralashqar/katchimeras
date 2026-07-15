import type { HomePreset, PersonalityQuestion, ZodiacProfile, ZodiacPrompt } from '@/types/world-identity';

export const HOME_PRESETS: readonly HomePreset[] = [
  { id: 'explorer', name: 'Explorer', description: 'A lookout home for curiosity, movement, and new horizons.', keywords: ['Curious', 'Adventurous', 'Open'], accent: '#7CC9A8', glyph: '↗' },
  { id: 'creator', name: 'Creator', description: 'A studio home for ideas, expression, and making things.', keywords: ['Creative', 'Curious', 'Expressive'], accent: '#E6A7C8', glyph: '✦' },
  { id: 'builder', name: 'Builder', description: 'A workshop home for plans, progress, and things made real.', keywords: ['Focused', 'Practical', 'Persistent'], accent: '#E5B86A', glyph: '◇' },
  { id: 'nurturer', name: 'Nurturer', description: 'A warm cottage for care, comfort, and steady growth.', keywords: ['Caring', 'Warm', 'Grounded'], accent: '#A8C99A', glyph: '❦' },
  { id: 'connector', name: 'Connector', description: 'A welcoming clubhouse built around shared moments.', keywords: ['Social', 'Welcoming', 'Collaborative'], accent: '#F09B78', glyph: '∞' },
  { id: 'dreamer', name: 'Dreamer', description: 'An observatory home for wonder, reflection, and imagination.', keywords: ['Reflective', 'Imaginative', 'Aware'], accent: '#AFA6F2', glyph: '☾' },
] as const;

const primary = (id: HomePreset['id'], label: string) => ({ id, label, scores: { [id]: 3 } });

export const PERSONALITY_QUESTIONS: readonly PersonalityQuestion[] = [
  {
    id: 'free-afternoon', question: 'You get a free afternoon. What sounds best?', answers: [
      primary('explorer', 'Explore somewhere unfamiliar'), primary('creator', 'Make or design something'),
      primary('builder', 'Finish a useful project'), primary('nurturer', 'Create a comfortable, caring space'),
      primary('connector', 'Bring a few people together'), primary('dreamer', 'Read, reflect, or daydream'),
    ],
  },
  {
    id: 'progress', question: 'What kind of progress feels most satisfying?', answers: [
      { id: 'discover', label: 'Discovering something new', scores: { explorer: 2, dreamer: 1 } },
      { id: 'create', label: 'Bringing an idea to life', scores: { creator: 2, dreamer: 1 } },
      { id: 'finish', label: 'Turning a plan into something finished', scores: { builder: 2, explorer: 1 } },
      { id: 'flourish', label: 'Helping someone or something flourish', scores: { nurturer: 2, connector: 1 } },
      { id: 'shared', label: 'Creating a shared moment', scores: { connector: 2, nurturer: 1 } },
      { id: 'understand', label: 'Understanding an idea or feeling', scores: { dreamer: 2, creator: 1 } },
    ],
  },
  {
    id: 'friends', question: 'What do friends usually come to you for?', answers: [
      { id: 'adventure', label: 'Spontaneity and adventure', scores: { explorer: 2, connector: 1 } },
      { id: 'spark', label: 'A creative spark', scores: { creator: 2, dreamer: 1 } },
      { id: 'next-step', label: 'A practical next step', scores: { builder: 2, nurturer: 1 } },
      { id: 'comfort', label: 'Comfort and encouragement', scores: { nurturer: 2, dreamer: 1 } },
      { id: 'together', label: 'Bringing everyone together', scores: { connector: 2, explorer: 1 } },
      { id: 'perspective', label: 'A thoughtful new perspective', scores: { dreamer: 2, creator: 1 } },
    ],
  },
] as const;

export const ZODIAC_PROFILES: readonly ZodiacProfile[] = [
  { id: 'aries', name: 'Aries', symbol: '♈', element: 'fire', dateLabel: 'Mar 21–Apr 19', accent: '#FF8A66', familiarName: 'Ember Ram', profileLine: 'A bright spark for brave beginnings.' },
  { id: 'taurus', name: 'Taurus', symbol: '♉', element: 'earth', dateLabel: 'Apr 20–May 20', accent: '#9DC58A', familiarName: 'Moss Bull', profileLine: 'A grounded light for comfort and patience.' },
  { id: 'gemini', name: 'Gemini', symbol: '♊', element: 'air', dateLabel: 'May 21–Jun 20', accent: '#F1D36F', familiarName: 'Twin Zephyr', profileLine: 'A curious breeze for questions and connection.' },
  { id: 'cancer', name: 'Cancer', symbol: '♋', element: 'water', dateLabel: 'Jun 21–Jul 22', accent: '#8DC8E8', familiarName: 'Moon Shell', profileLine: 'A gentle tide for memory and belonging.' },
  { id: 'leo', name: 'Leo', symbol: '♌', element: 'fire', dateLabel: 'Jul 23–Aug 22', accent: '#F5B85D', familiarName: 'Sun Mane', profileLine: 'A warm glow for courage and expression.' },
  { id: 'virgo', name: 'Virgo', symbol: '♍', element: 'earth', dateLabel: 'Aug 23–Sep 22', accent: '#A7C78F', familiarName: 'Grain Keeper', profileLine: 'A careful light for craft and small details.' },
  { id: 'libra', name: 'Libra', symbol: '♎', element: 'air', dateLabel: 'Sep 23–Oct 22', accent: '#D9A6D4', familiarName: 'Orbit Keeper', profileLine: 'A floating calm for harmony and perspective.' },
  { id: 'scorpio', name: 'Scorpio', symbol: '♏', element: 'water', dateLabel: 'Oct 23–Nov 21', accent: '#9A83D5', familiarName: 'Deep Comet', profileLine: 'A moonlit current for depth and transformation.' },
  { id: 'sagittarius', name: 'Sagittarius', symbol: '♐', element: 'fire', dateLabel: 'Nov 22–Dec 21', accent: '#EE9070', familiarName: 'Comet Archer', profileLine: 'A roaming flame for discovery and possibility.' },
  { id: 'capricorn', name: 'Capricorn', symbol: '♑', element: 'earth', dateLabel: 'Dec 22–Jan 19', accent: '#87B7A2', familiarName: 'Peak Horn', profileLine: 'A steady star for patience and meaningful progress.' },
  { id: 'aquarius', name: 'Aquarius', symbol: '♒', element: 'air', dateLabel: 'Jan 20–Feb 18', accent: '#78C8DA', familiarName: 'Sky Vessel', profileLine: 'An unusual current for invention and change.' },
  { id: 'pisces', name: 'Pisces', symbol: '♓', element: 'water', dateLabel: 'Feb 19–Mar 20', accent: '#83AEE2', familiarName: 'Dream Fins', profileLine: 'A soft tide for feeling and imagination.' },
] as const;

const PROMPT_TEXT: Record<ZodiacProfile['id'], readonly string[]> = {
  aries: ['What could you begin today without overthinking it?', 'Where would one brave little step help?', 'What deserves your first spark today?'],
  taurus: ['What small change would make today more comfortable?', 'What is worth taking slowly?', 'Where could you make a little more room?'],
  gemini: ['What question could lead somewhere interesting?', 'What thought would you like to share?', 'What has caught your curiosity today?'],
  cancer: ['What moment would you like to remember?', 'Where did you feel most at home today?', 'What deserves a little care?'],
  leo: ['What are you quietly proud of?', 'Where could you let yourself be seen?', 'What brought warmth to your day?'],
  virgo: ['What small thing could you gently organise?', 'What detail made a difference today?', 'What can be made a little simpler?'],
  libra: ['Is anything feeling slightly out of balance?', 'What would make today feel more harmonious?', 'Which perspective have you not considered?'],
  scorpio: ['What feeling deserves a closer look?', 'What changed beneath the surface today?', 'What are you ready to understand more deeply?'],
  sagittarius: ['What new place, idea, or experience could you explore?', 'Where did your curiosity pull you?', 'What possibility feels exciting?'],
  capricorn: ['What is one useful step toward something important?', 'What steady effort deserves credit?', 'What would future you thank you for?'],
  aquarius: ['What unusual solution might be worth trying?', 'What would you change if you could?', 'Which original idea keeps returning?'],
  pisces: ['What have you imagined, dreamed, or felt today?', 'What did your intuition notice?', 'Where did your mind gently wander?'],
};
export const ZODIAC_PROMPTS: readonly ZodiacPrompt[] = ZODIAC_PROFILES.flatMap((profile) => PROMPT_TEXT[profile.id].map((text, index) => ({ id: `${profile.id}-${index + 1}`, signId: profile.id, text })));
