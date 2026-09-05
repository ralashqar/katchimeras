import { CelebrationHeroNumber } from '@/components/katchadeck/ui/celebration-hero-number';

export function StreakHeroTitle({ days }: { days: number }) {
  return (
    <CelebrationHeroNumber accessibilityLabel={`${days} day streak`} label="DAY STREAK" value={days} />
  );
}
