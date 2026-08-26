import { MOSSPROUT_FTUE_SCRIPT } from './mossprout-ftue-script';
import type { FtueHandlerId } from './ftue-types';

export const FTUE_HANDLER_REGISTRY: Record<FtueHandlerId, { commitOwner: 'frontend' | 'domain-observer'; privacy: 'answer-id-only' | 'no-answer' }> = {
  day_prompt: { commitOwner: 'frontend', privacy: 'answer-id-only' },
  private_growth: { commitOwner: 'frontend', privacy: 'no-answer' },
  journal_photo: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  journal_text: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  journal_people: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  journal_place: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  discovery_hatch: { commitOwner: 'frontend', privacy: 'no-answer' },
  companion_conversation: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  companion_order_preview: { commitOwner: 'frontend', privacy: 'no-answer' },
  merge_item_created: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  merge_parcel_claimed: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  merge_generator_spawned: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  merge_order_served: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  merge_chat_note_opened: { commitOwner: 'frontend', privacy: 'no-answer' },
  merge_energy_depleted: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  pedometer_steps: { commitOwner: 'frontend', privacy: 'no-answer' },
  movement_context: { commitOwner: 'frontend', privacy: 'answer-id-only' },
  haven_upgrade: { commitOwner: 'domain-observer', privacy: 'no-answer' },
  haven_reveal: { commitOwner: 'frontend', privacy: 'no-answer' },
  player_profile: { commitOwner: 'frontend', privacy: 'no-answer' },
  acknowledgement: { commitOwner: 'frontend', privacy: 'no-answer' },
};

export const FTUE_ACTION_CATALOG = MOSSPROUT_FTUE_SCRIPT.steps.flatMap((step) => step.actions.map((action) => ({
  actionId: action.id,
  backendEvent: Boolean(action.backendEvent),
  handler: FTUE_HANDLER_REGISTRY[action.handlerId],
  scriptId: MOSSPROUT_FTUE_SCRIPT.id,
  scriptVersion: MOSSPROUT_FTUE_SCRIPT.version,
  stepId: step.id,
  surface: step.surface,
})));
