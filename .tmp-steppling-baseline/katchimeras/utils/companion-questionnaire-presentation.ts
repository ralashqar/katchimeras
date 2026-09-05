import type { ComponentProps } from 'react';
import { Image } from 'expo-image';

import type { IconSymbolName } from '@/components/ui/icon-symbol';

export type QuestionnaireImageSource = ComponentProps<typeof Image>['source'];

const OPTION_ICONS: Record<string, IconSymbolName> = {
  build: 'plus',
  different: 'arrow.counterclockwise',
  experiment: 'sparkles',
  pause: 'pause.fill',
  remember: 'book.closed.fill',
  repeat: 'arrow.counterclockwise',
  smaller: 'scope',
  supported: 'heart.fill',
};

const LABEL_ICON_RULES: readonly [RegExp, IconSymbolName][] = [
  [/\b(outside|outdoor|nature|living|growing|plant)\b/i, 'leaf.fill'],
  [/\b(walk|walking|steps|move|movement)\b/i, 'figure.walk'],
  [/\b(run|running|exercise|workout|gym)\b/i, 'figure.run'],
  [/\b(sleep|night|rest|bed)\b/i, 'moon.stars.fill'],
  [/\b(food|meal|eat|cook)\b/i, 'fork.knife'],
  [/\b(friend|family|together|someone|share)\b/i, 'person.2.fill'],
  [/\b(home|place|room)\b/i, 'house.fill'],
  [/\b(work|task|finish|clear|close)\b/i, 'list.clipboard.fill'],
  [/\b(play|game|fun)\b/i, 'gamecontroller.fill'],
  [/\b(read|learn|word|book)\b/i, 'book.fill'],
  [/\b(photo|picture|noticed|see)\b/i, 'camera.fill'],
  [/\b(calm|pause|quiet|breath)\b/i, 'cloud.fill'],
  [/\b(happy|joy|good|worked|supported)\b/i, 'face.smiling'],
  [/\b(difficult|blocked|hard)\b/i, 'exclamationmark.triangle.fill'],
  [/\b(try|next|build|change|different)\b/i, 'sparkles'],
];

export function companionQuestionnaireOptionIcon(
  optionId: string,
  label: string
): IconSymbolName | null {
  const exact = OPTION_ICONS[optionId];
  if (exact) return exact;
  return LABEL_ICON_RULES.find(([pattern]) => pattern.test(label))?.[1] ?? null;
}
