import { InteractionThreadSwitcher, type InteractionThreadOption } from '@/components/katchadeck/ui/interaction-thread-switcher';
import type { CompanionThread } from '@/types/companion-interaction';

const THREADS: InteractionThreadOption<CompanionThread>[] = [
  { id: 'quest', label: 'Do', icon: 'checkmark' },
  { id: 'insight', label: 'Insight', icon: 'star.fill' },
  { id: 'skins', label: 'Skins', icon: 'circle.grid.2x2.fill' },
];

export function CompanionThreadSwitcher({
  value,
  onChange,
  showSkins,
}: {
  value: CompanionThread;
  onChange: (thread: CompanionThread) => void;
  showSkins: boolean;
}) {
  const options = showSkins ? THREADS : THREADS.filter((thread) => thread.id !== 'skins');
  return <InteractionThreadSwitcher options={options} value={value} onChange={onChange} />;
}
