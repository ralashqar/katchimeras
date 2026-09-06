import type { BigMomentType } from '@/types/home';

// On-device, dependency-free interpretation of a note's text → a mood + an
// optional Big Moment. This is the offline FALLBACK; the cloud interpreter
// (interpret-voice-note edge fn) will produce richer results, but every path
// degrades to this so notes always do something. Pure → unit-testable.

export type NoteArchetype = 'calm' | 'energy' | 'together' | 'meaningful';

export type NoteInterpretation = {
  archetype: NoteArchetype;
  label: string;
  bigMoment?: { type: BigMomentType; subject: string | null };
};

// First match wins. Order matters (birthday before holiday, etc.).
const BIG_MOMENT_RULES: { type: BigMomentType; re: RegExp; label: string }[] = [
  { type: 'birthday', re: /\bbirthday|\bbday\b|turning \d+/, label: 'Birthday' },
  { type: 'anniversary', re: /anniversary/, label: 'Anniversary' },
  { type: 'firstTime', re: /first time|first day|my first\b|first ever/, label: 'A first' },
  { type: 'holiday', re: /christmas|thanksgiving|new year|halloween|easter|\beid\b|diwali|hanukkah|\bholiday\b/, label: 'Holiday' },
  { type: 'trip', re: /\btrip\b|vacation|holiday trip|road trip|flight|\bflew\b|travel(l)?ing|\bairport\b/, label: 'A trip' },
  { type: 'achievement', re: /promotion|promoted|got the job|new job|graduat|\bwon\b|\baward\b|passed (my|the)|finished the|\baced\b/, label: 'An achievement' },
  { type: 'milestone', re: /wedding|engaged|got married|\bbaby\b|new home|new house|bought a (house|home|car)|moved (in|house|home)/, label: 'A milestone' },
];

const SUBJECT_RE =
  /\b(?:my |our )?(son|daughter|wife|husband|partner|mum|mom|dad|mother|father|brother|sister|friend|kid|child|baby|grandma|grandpa|grandmother|grandfather)\b/;

const MOOD_KEYWORDS: Record<NoteArchetype, RegExp> = {
  together: /\b(friend|family|together|son|daughter|wife|husband|partner|mum|mom|dad|party|dinner with|hangout|hung out|met up|celebrat)/,
  energy: /\b(workout|\bran\b|\brun\b|\bgym\b|active|busy|excited|hectic|energ|adventure|hike|hiked)/,
  meaningful: /\b(grateful|gratitude|proud|meaning|milestone|love|loved|special|reflect|important|remember)/,
  calm: /\b(calm|peaceful|quiet|rest|rested|relax|cozy|cosy|slow|gentle|still|breathe)/,
};

function capitalize(word: string): string {
  return word.length ? word[0].toUpperCase() + word.slice(1) : word;
}

function detectMood(text: string): NoteArchetype {
  // Count keyword hits per mood; ties resolve in a stable priority order.
  const order: NoteArchetype[] = ['together', 'meaningful', 'energy', 'calm'];
  let best: NoteArchetype = 'calm';
  let bestN = 0;
  for (const mood of order) {
    const matches = text.match(new RegExp(MOOD_KEYWORDS[mood], 'g'));
    const n = matches ? matches.length : 0;
    if (n > bestN) {
      best = mood;
      bestN = n;
    }
  }
  return best;
}

export function interpretNoteText(rawText: string): NoteInterpretation {
  const text = (rawText ?? '').toLowerCase().trim();

  let bigMoment: NoteInterpretation['bigMoment'];
  let bigLabel: string | null = null;
  for (const rule of BIG_MOMENT_RULES) {
    if (rule.re.test(text)) {
      const subject = SUBJECT_RE.exec(text)?.[1] ?? null;
      bigMoment = { type: rule.type, subject };
      bigLabel =
        subject && rule.type === 'birthday'
          ? `${capitalize(subject)}'s birthday`
          : rule.label;
      break;
    }
  }

  // A Big Moment reads as meaningful unless a stronger social cue is present.
  const mood = bigMoment ? (MOOD_KEYWORDS.together.test(text) ? 'together' : 'meaningful') : detectMood(text);

  const snippet = rawText.trim().replace(/\s+/g, ' ').slice(0, 32);
  const label = bigLabel ?? (snippet || capitalize(mood));

  return bigMoment ? { archetype: mood, label, bigMoment } : { archetype: mood, label };
}
