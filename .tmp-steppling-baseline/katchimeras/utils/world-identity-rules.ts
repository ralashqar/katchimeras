import { HOME_PRESETS, PERSONALITY_QUESTIONS, ZODIAC_PROMPTS } from '../constants/world-identity';
import type { HomeArchetypeId, PersonalityAnswerMap, ZodiacSignId } from '../types/world-identity';

export function scorePersonality(answers: PersonalityAnswerMap): HomeArchetypeId | null {
  const totals = Object.fromEntries(HOME_PRESETS.map((preset) => [preset.id, 0])) as Record<HomeArchetypeId, number>;
  let answered = 0;
  for (const question of PERSONALITY_QUESTIONS) {
    const answer = question.answers.find((item) => item.id === answers[question.id]);
    if (!answer) continue;
    answered += 1;
    for (const [key, score] of Object.entries(answer.scores)) totals[key as HomeArchetypeId] += score ?? 0;
  }
  if (!answered) return null;
  const firstChoice = answers[PERSONALITY_QUESTIONS[0].id] as HomeArchetypeId | undefined;
  return HOME_PRESETS.map((item) => item.id).sort((a, b) => totals[b] - totals[a] || (a === firstChoice ? -1 : b === firstChoice ? 1 : 0))[0];
}

export function validBirthday(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) return false;
  return day <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function deriveZodiacSign(month: number, day: number): ZodiacSignId | null {
  if (!validBirthday(month, day)) return null;
  const md = month * 100 + day;
  if (md >= 321 && md <= 419) return 'aries'; if (md <= 520 && md >= 420) return 'taurus';
  if (md <= 620 && md >= 521) return 'gemini'; if (md <= 722 && md >= 621) return 'cancer';
  if (md <= 822 && md >= 723) return 'leo'; if (md <= 922 && md >= 823) return 'virgo';
  if (md <= 1022 && md >= 923) return 'libra'; if (md <= 1121 && md >= 1023) return 'scorpio';
  if (md <= 1221 && md >= 1122) return 'sagittarius'; if (md >= 1222 || md <= 119) return 'capricorn';
  if (md <= 218) return 'aquarius'; return 'pisces';
}

export function localDayId(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function promptForDay(signId: ZodiacSignId, date = new Date()) {
  const pool = ZODIAC_PROMPTS.filter((prompt) => prompt.signId === signId);
  const seed = Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000);
  return pool[Math.abs(seed) % pool.length];
}
