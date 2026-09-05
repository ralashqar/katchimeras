import type { KatchimeraSkinId } from '@/types/katchimera';

export type MossproutResidentDefinition = {
  id: KatchimeraSkinId;
  revealDialogue: string;
  requestThemes: readonly ('garden' | 'waterside' | 'keepsake')[];
  requestCopy: readonly { title: string; description: string }[];
};

export const MOSSPROUT_GARDEN_RESIDENT_IDS = ['petalimp', 'fernip', 'blossle', 'amberleaf'] as const;
export const MOSSPROUT_WEATHER_RESIDENT_IDS = ['drizzlet', 'mistle', 'driftkin', 'tempesto'] as const;
export const MOSSPROUT_RESIDENT_IDS = ['mossprout', ...MOSSPROUT_GARDEN_RESIDENT_IDS, ...MOSSPROUT_WEATHER_RESIDENT_IDS] as const;

export const MOSSPROUT_RESIDENTS: readonly MossproutResidentDefinition[] = [
  { id: 'mossprout', revealDialogue: 'I was already here, but I still like a dramatic entrance.', requestThemes: ['garden', 'waterside', 'keepsake'], requestCopy: [
    { title: 'A little Garden beginning', description: 'Mossprout has found one reachable thing the garden can use.' },
    { title: 'Something for the shared patch', description: 'A small request for the part of the garden you have grown together.' },
    { title: 'A patient piece', description: 'Bring something that can take its time becoming useful.' },
    { title: 'The next growing thing', description: 'Mossprout knows exactly where one more living detail could belong.' },
  ] },
  { id: 'petalimp', revealDialogue: 'Mossprout said this garden needed taste. I brought plenty. Help me place two things?', requestThemes: ['garden'], requestCopy: [
    { title: 'Petalimp picks a colour', description: 'Petalimp would like one bloom bright enough to reorganise the whole flower bed.' },
    { title: 'A very important flower', description: 'The importance is mostly decided by Petalimp, but the flower will help.' },
    { title: 'Seasonal arrangements', description: 'Petalimp is testing which growing things look happiest together.' },
    { title: 'One more flourish', description: 'The nursery apparently needs a final floral exclamation mark.' },
  ] },
  { id: 'fernip', revealDialogue: 'Oh, hello. I found a quiet corner worth staying for. It only needs two small things.', requestThemes: ['garden', 'keepsake'], requestCopy: [
    { title: 'Something from the shade', description: 'Fernip is making a quiet woodland corner behind the nursery.' },
    { title: 'A path through the ferns', description: 'Bring something living or remembered to mark the hidden route.' },
    { title: 'Underleaf work', description: 'Fernip has found a job best completed where the light is soft.' },
    { title: 'The secret green shelf', description: 'A tucked-away place needs one carefully chosen garden piece.' },
  ] },
  { id: 'blossle', revealDialogue: 'I can almost see this place in bloom. Two little jobs, and I think I belong here.', requestThemes: ['garden'], requestCopy: [
    { title: 'Blossle tends the nursery', description: 'A young bed needs something gentle enough to grow beside.' },
    { title: 'The blossom forecast', description: 'Blossle predicts flowers, provided the right pieces arrive.' },
    { title: 'A bed ready to wake', description: 'The nursery soil is waiting for a bright new beginning.' },
    { title: 'Care in bloom', description: 'Blossle wants the next patch to look visibly cared for.' },
  ] },
  { id: 'amberleaf', revealDialogue: 'Every garden should keep proof that it changed. Help me save two pieces of this one.', requestThemes: ['garden', 'keepsake'], requestCopy: [
    { title: 'A season worth keeping', description: 'Amberleaf is preserving one small sign that the garden changed.' },
    { title: 'The copper-coloured corner', description: 'Bring a growing or remembered piece for Amberleaf’s seasonal display.' },
    { title: 'Leaves with a history', description: 'Amberleaf is arranging the details that make returning feel different.' },
    { title: 'Before the colour changes', description: 'One more garden keepsake belongs in the collection.' },
  ] },
  { id: 'drizzlet', revealDialogue: 'I followed the rain here. Give me two puddle-sized jobs and I may never leave.', requestThemes: ['waterside'], requestCopy: [
    { title: 'A place for drizzle', description: 'Drizzlet wants the pond edge ready for the next soft rain.' },
    { title: 'The first-drop survey', description: 'Bring something that looks better with rain on it.' },
    { title: 'A damp little improvement', description: 'Drizzlet has identified a very specific waterside opportunity.' },
    { title: 'Rain belongs here', description: 'The pond needs one more piece that can welcome wet weather.' },
  ] },
  { id: 'mistle', revealDialogue: 'You noticed me through the mist. Most people hurry past. Shall we make two quiet things?', requestThemes: ['waterside', 'keepsake'], requestCopy: [
    { title: 'Something seen through mist', description: 'Mistle is building a quiet reflection beside the water.' },
    { title: 'A soft-edged memory', description: 'Bring a waterside or keepsake piece that does not explain everything.' },
    { title: 'The garden keeps one secret', description: 'Mistle knows where a half-hidden detail should go.' },
    { title: 'Morning at the pond', description: 'One reflective piece will complete Mistle’s pale little scene.' },
  ] },
  { id: 'driftkin', revealDialogue: 'This place might hold through winter. I have two tests before I trust it completely.', requestThemes: ['waterside', 'garden'], requestCopy: [
    { title: 'A patch that can weather winter', description: 'Driftkin is checking which garden pieces can stay steady through the cold.' },
    { title: 'Frost at the waterline', description: 'Bring something hardy for the pond’s quietest season.' },
    { title: 'Shelter before snow', description: 'Driftkin wants one strong piece in place before the weather changes.' },
    { title: 'The winter garden test', description: 'A sturdy growing or waterside piece is required.' },
  ] },
  { id: 'tempesto', revealDialogue: 'At last, a reveal with proper drama. Two bold improvements, then this garden has me.', requestThemes: ['garden', 'waterside'], requestCopy: [
    { title: 'Ready for dramatic weather', description: 'Tempesto is strengthening the grove before the next excellent storm.' },
    { title: 'The thunder garden', description: 'Bring a powerful garden or waterside piece worthy of the name.' },
    { title: 'Wind-tested growth', description: 'Tempesto wants something that looks as though it can hold its ground.' },
    { title: 'After the storm', description: 'One resilient piece will help the garden recover brighter.' },
  ] },
] as const;

export const mossproutResidentById = new Map(MOSSPROUT_RESIDENTS.map((resident) => [resident.id, resident]));
