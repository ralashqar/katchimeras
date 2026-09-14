import { InteractionThreadSwitcher, type InteractionThreadOption } from '@/components/katchadeck/ui/interaction-thread-switcher';
import type { CompanionThread } from '@/types/companion-interaction';

const THREADS: InteractionThreadOption<CompanionThread>[] = [
  { id: 'skins', label: 'Skins', icon: 'circle.grid.2x2.fill' },
];

export function CompanionThreadSwitcher({
  value,
  onChange,
}: {
  value: CompanionThread;
  onChange: (thread: CompanionThread) => void;
  showSkins?: boolean;
}) {
  return <InteractionThreadSwitcher options={THREADS} value={value} onChange={onChange} />;
}
