import { InteractionThreadSwitcher, type InteractionThreadOption } from '@/components/katchadeck/ui/interaction-thread-switcher';
import type { CompanionThread } from '@/types/companion-interaction';

const THREADS: InteractionThreadOption<CompanionThread>[] = [
  { id: 'quest', label: 'Quest', icon: 'sparkles' },
  { id: 'insight', label: 'Insight', icon: 'star.fill' },
  { id: 'reflection', label: 'Reflect', icon: 'leaf.fill' },
];

export function CompanionThreadSwitcher({ value, onChange }: { value: CompanionThread; onChange: (thread: CompanionThread) => void }) {
  return <InteractionThreadSwitcher options={THREADS} value={value} onChange={onChange} />;
}
