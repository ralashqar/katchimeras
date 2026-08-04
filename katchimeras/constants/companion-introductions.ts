import { katchimeraFamilies } from '@/constants/katchimera-skins';
import type { KatchimeraFamilyId } from '@/types/katchimera';

export type CompanionSupportStyle = 'gentle' | 'practical' | 'patterns' | 'on_demand';

export type CompanionIntroductionDefinition = {
  familyId: KatchimeraFamilyId;
  greeting: string;
  homeGreeting: string;
  returnGreeting: string;
};

export const COMPANION_SUPPORT_STYLE_OPTIONS: readonly {
  id: CompanionSupportStyle;
  label: string;
  summary: string;
}[] = [
  { id: 'gentle', label: 'Keep things gentle and flexible', summary: 'keep things gentle and easy to change' },
  { id: 'practical', label: 'Give me practical small steps', summary: 'offer clear, practical next steps' },
  { id: 'patterns', label: 'Help me notice patterns', summary: 'help you notice patterns before we act' },
  { id: 'on_demand', label: 'Wait until I ask', summary: 'stay quiet until you choose to check in' },
] as const;

const copy: Readonly<Record<string, Omit<CompanionIntroductionDefinition, 'familyId'>>> = {
  baristabbit: {
    greeting: 'I’m Baristabbit. I’m here for small pauses that make the day feel more yours.',
    homeGreeting: 'I’m ready whenever a small pause would help.',
    returnGreeting: 'I’m glad you found your way back. We can begin with one small pause.',
  },
  feastle: {
    greeting: 'I’m Feastle. I’m here to make food feel more manageable, enjoyable, and yours.',
    homeGreeting: 'I’m here for whatever food needs to be today.',
    returnGreeting: 'I’m glad you’re back. We can start with what feels possible around food now.',
  },
  steppling: {
    greeting: 'I’m Steppling. I’m here for walks, runs, trails, and every small step between them.',
    homeGreeting: 'I’m ready to take the next step with you.',
    returnGreeting: 'It’s good to see you again. We can find a pace that fits today.',
  },
  flexel: {
    greeting: 'I’m Flexel. I’m here to help movement feel capable, adaptable, and worth returning to.',
    homeGreeting: 'I’m ready to move in a way that fits you.',
    returnGreeting: 'Welcome back. We can begin from where your body and energy are now.',
  },
  bedrotte: {
    greeting: 'I’m Bedrotte. I’m here to protect rest, comfort, and gentler endings to the day.',
    homeGreeting: 'I’m here when you need a softer place to land.',
    returnGreeting: 'I’m glad you’re back. There’s no need to catch up—just arrive.',
  },
  dawnle: {
    greeting: 'I’m Dawnle. I’m here for kinder mornings and first steps that do not ask too much.',
    homeGreeting: 'I’m ready to help the day begin gently.',
    returnGreeting: 'It’s lovely to see you again. We can begin with one manageable morning step.',
  },
  mendle: {
    greeting: 'I’m Mendle. I’m here to notice hard days honestly and help you choose a kinder response.',
    homeGreeting: 'I’m here to meet the day as it really is.',
    returnGreeting: 'I’m glad you came back. You do not need to explain the time away.',
  },
  gatherglow: {
    greeting: 'I’m Gatherglow. I’m here for friendship, belonging, and connection that feels mutual.',
    homeGreeting: 'I’m here to help connection feel a little easier.',
    returnGreeting: 'I’m happy to see you again. We can reconnect without rushing.',
  },
  heartmote: {
    greeting: 'I’m Heartmote. I’m here for care, honesty, and time with the people closest to you.',
    homeGreeting: 'I’m here for the relationships you want to tend with care.',
    returnGreeting: 'I’m glad you’re back. We can listen for what closeness needs now.',
  },
  kindling: {
    greeting: 'I’m Kindling. I’m here for helping, contributing, and belonging without burning yourself out.',
    homeGreeting: 'I’m ready to help one useful spark become enough.',
    returnGreeting: 'Welcome back. We can find one sustainable way to contribute.',
  },
  snuglet: {
    greeting: 'I’m Snuglet. I’m here to support the care you give and keep your needs visible too.',
    homeGreeting: 'I’m here for both the person you care for and the caregiver in you.',
    returnGreeting: 'I’m glad you’re back. We can begin with what care asks of you now.',
  },
  waglet: {
    greeting: 'I’m Waglet. I’m here for the routines, play, and quiet affection you share with pets.',
    homeGreeting: 'I’m ready for whatever companionship looks like today.',
    returnGreeting: 'I’m happy you’re back. We can pick up with one small moment of care or play.',
  },
  tasklet: {
    greeting: 'I’m Tasklet. I’m here to help meaningful work become clearer, smaller, and finishable.',
    homeGreeting: 'I’m ready to help you choose what deserves attention.',
    returnGreeting: 'Welcome back. We can choose one useful thread instead of chasing everything.',
  },
  errandimp: {
    greeting: 'I’m Errandimp. I’m here for errands, chores, and loose ends that need a manageable next step.',
    homeGreeting: 'I’m ready to help one practical thing move.',
    returnGreeting: 'I’m glad you’re back. We can close one small loop and leave the rest alone.',
  },
  pagelet: {
    greeting: 'I’m Pagelet. I’m here for books, questions, ideas, and learning at your own pace.',
    homeGreeting: 'I’m ready to follow whichever idea still feels alive.',
    returnGreeting: 'It’s good to see you again. We can reopen one question without starting over.',
  },
  relicoon: {
    greeting: 'I’m Relicoon. I’m here for museums, history, objects, and the stories they still carry.',
    homeGreeting: 'I’m ready to look closer at something worth remembering.',
    returnGreeting: 'Welcome back. There are always more stories waiting when you are ready.',
  },
  museling: {
    greeting: 'I’m Museling. I’m here for ideas, making, practising, and creative work without perfection.',
    homeGreeting: 'I’m ready to help one creative spark find some room.',
    returnGreeting: 'I’m glad you came back. Your creative thread is still here.',
  },
  encora: {
    greeting: 'I’m Encora. I’m here for listening, playing, practising, and sharing music your way.',
    homeGreeting: 'I’m listening for what music could give you today.',
    returnGreeting: 'It’s good to hear from you again. We can return on any note.',
  },
  flickerbun: {
    greeting: 'I’m Flickerbun. I’m here for screen stories you choose, enjoy, and want to remember.',
    homeGreeting: 'I’m ready for the next story that feels worth your time.',
    returnGreeting: 'Welcome back. We can find a story that fits the mood you’re in now.',
  },
  pixooka: {
    greeting: 'I’m Pixooka. I’m here for play, mastery, stories, and stopping when the session feels complete.',
    homeGreeting: 'I’m ready to make play feel chosen and satisfying.',
    returnGreeting: 'I’m glad you’re back. We can start a fresh round without chasing lost progress.',
  },
  mossprout: {
    greeting: 'I’m Mossprout. I’m here for parks, plants, weather, and nearby nature you can truly reach.',
    homeGreeting: 'I’m ready to notice one living detail with you.',
    returnGreeting: 'I’m glad you returned. Nearby nature has kept changing while we were apart.',
  },
  shellio: {
    greeting: 'I’m Shellio. I’m here for swimming, beaches, water confidence, and calm beside the water.',
    homeGreeting: 'I’m ready to meet the water at a pace that feels safe.',
    returnGreeting: 'Welcome back. We can return to the water gently, whether or not we swim.',
  },
  skylo: {
    greeting: 'I’m Skylo. I’m here for neighbourhoods, city details, and familiar routes seen differently.',
    homeGreeting: 'I’m ready to find something new in the places around us.',
    returnGreeting: 'I’m glad you’re back. The city can wait while we choose one corner to notice.',
  },
  voyagle: {
    greeting: 'I’m Voyagle. I’m here for journeys, unfamiliar places, and what you bring home from them.',
    homeGreeting: 'I’m ready for whichever part of the journey matters now.',
    returnGreeting: 'Welcome back. We can begin with where you are, not where you left off.',
  },
  cheerlet: {
    greeting: 'I’m Cheerlet. I’m here to notice progress, celebrate what matters, and honour changing chapters.',
    homeGreeting: 'I’m ready to notice something worth marking.',
    returnGreeting: 'I’m happy you’re back. Even the time between visits may hold progress worth noticing.',
  },
};

export const companionIntroductionDefinitions: readonly CompanionIntroductionDefinition[] =
  katchimeraFamilies.map((family) => ({
    familyId: family.id,
    ...(copy[family.id] ?? {
      greeting: `I’m ${family.displayName}. I’m here to explore ${family.lifeAreaLabel.toLowerCase()} with you.`,
      homeGreeting: 'I’m here whenever you want to spend a moment together.',
      returnGreeting: 'I’m glad you found your way back. We can begin from where you are now.',
    }),
  }));

export const companionIntroductionByFamilyId = new Map(
  companionIntroductionDefinitions.map((definition) => [definition.familyId, definition])
);

export function validateCompanionIntroductionDefinitions(): string[] {
  const issues: string[] = [];
  for (const family of katchimeraFamilies) {
    const definition = companionIntroductionByFamilyId.get(family.id);
    if (!definition) {
      issues.push(`${family.id}: missing introduction`);
      continue;
    }
    for (const [field, value, max] of [
      ['greeting', definition.greeting, 130],
      ['homeGreeting', definition.homeGreeting, 90],
      ['returnGreeting', definition.returnGreeting, 130],
    ] as const) {
      if (value.length > max) issues.push(`${family.id}: ${field} exceeds ${max} characters`);
    }
  }
  return issues;
}
