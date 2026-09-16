export type CompanionLifeActivity = 'photo' | 'notice' | 'moment';

/** One store per friend; Mossprout's key and ids are the ones he always had. */
export const companionLifeActivityKey = (companion: string) => `companion:${companion}-life-activities:v1`;
export const companionLifeActivityId = (companion: string, dayId: string, kind: CompanionLifeActivity) => `${companion}:life:${dayId}:${kind}`;
