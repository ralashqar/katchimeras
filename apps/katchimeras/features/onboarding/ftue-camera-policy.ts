import type { FtueStepDefinition } from './ftue-types';

/** Guided steps are safe by default; authors can explicitly allow exploration. */
export function ftueLocksCamera(step: FtueStepDefinition | null | undefined): boolean {
  return Boolean(step && step.id !== 'complete' && step.lockCamera !== false);
}
