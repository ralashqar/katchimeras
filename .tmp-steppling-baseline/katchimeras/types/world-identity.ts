export type HomeArchetypeId = 'explorer' | 'creator' | 'builder' | 'nurturer' | 'connector' | 'dreamer';

export type ZodiacSignId =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type ZodiacElement = 'fire' | 'earth' | 'air' | 'water';

export type PersonalityAnswerMap = Record<string, string>;

export type WorldIdentityState = {
  version: 2;
  personalityAnswers: PersonalityAnswerMap;
  recommendedHomeArchetypeId: HomeArchetypeId | null;
  selectedHomeArchetypeId: HomeArchetypeId | null;
  birthMonth: number | null;
  birthDay: number | null;
  zodiacSignId: ZodiacSignId | null;
  setupCompletedAt: string | null;
  zodiacRitualCompletions: string[];
  recentZodiacPromptIds: string[];
  zodiacReflections: ZodiacReflection[];
};

export type ZodiacReflection = {
  id: string;
  dayId: string;
  promptId: string;
  prompt: string;
  text: string;
  audioUri?: string | null;
  durationMs?: number | null;
  createdAt: string;
  origin: 'zodiac_prompt';
};

export type HomePreset = {
  id: HomeArchetypeId;
  name: string;
  description: string;
  keywords: readonly [string, string, string];
  accent: string;
  glyph: string;
};

export type PersonalityAnswer = {
  id: string;
  label: string;
  scores: Partial<Record<HomeArchetypeId, number>>;
};

export type PersonalityQuestion = {
  id: string;
  question: string;
  answers: readonly PersonalityAnswer[];
};

export type ZodiacProfile = {
  id: ZodiacSignId;
  name: string;
  symbol: string;
  element: ZodiacElement;
  dateLabel: string;
  accent: string;
  familiarName: string;
  profileLine: string;
};

export type ZodiacPrompt = {
  id: string;
  signId: ZodiacSignId;
  text: string;
};
