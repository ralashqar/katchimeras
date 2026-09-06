import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CompactMomentList } from '@/components/katchadeck/home/compact-moment-list';
import { KatchaButton } from '@/components/katchadeck/ui/katcha-button';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';
import { SegmentedControl } from '@/components/katchadeck/ui/segmented-control';
import { KatchaUI } from '@/constants/katcha-ui';
import type { HomeDayRecord } from '@/types/home';
import { buildMomentTimeline, type MomentTimelineEntry } from '@/utils/moment-timeline';

type MomentFilter = 'all' | 'highlights' | 'recent';

const FILTERS = [
  { value: 'all', label: 'All', icon: 'sparkles' },
  { value: 'highlights', label: 'Highlights', icon: 'star.fill' },
  { value: 'recent', label: 'Recent', icon: 'clock' },
] as const;

export function SanctuarySheet({
  day,
  onAddMoment,
  onClose,
}: {
  day: HomeDayRecord;
  onAddMoment?: () => void;
  onClose: () => void;
}) {
  const history = useMemo(() => buildMomentTimeline(day), [day]);
  const [filter, setFilter] = useState<MomentFilter>('all');

  const visibleHistory = useMemo(() => {
    if (filter === 'recent') return history.slice(-3);
    if (filter === 'highlights') return history.filter(isHighlight);
    return history;
  }, [filter, history]);

  const footer = onAddMoment ? <KatchaButton fullWidth icon="plus" label="Add another moment" onPress={onAddMoment} /> : undefined;

  return (
    <KatchaSheet
      footer={footer}
      header={{
        eyebrow: 'Moments',
        title: history.length > 0 ? `${history.length} ${history.length === 1 ? 'moment' : 'moments'} from today` : 'A quiet day, so far',
        titleVariant: 'strong',
        subtitle: history.length > 0 ? 'The small pieces you chose to keep.' : 'Anything you add will gather here in time order.',
      }}
      onRequestClose={onClose}
      scroll
      scrollContentStyle={styles.scroll}
      size="tall"
      surface="parchment">
      <View style={styles.body}>
        {history.length > 0 ? <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} optionStyle={styles.filterOption} /> : null}
        <CompactMomentList
          emptyBody={history.length === 0
            ? 'Photos, notes, places and feelings will form today’s story here.'
            : 'The meaningful moments you mark will gather here.'}
          emptyTitle={history.length === 0 ? 'Nothing kept yet' : 'No highlights yet'}
          entries={visibleHistory}
        />
      </View>
    </KatchaSheet>
  );
}

function isHighlight(item: MomentTimelineEntry): boolean {
  return item.category === 'Life event' || item.category === 'Moment' || !!item.thumbnailUri || !!item.noteText?.trim();
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 16, paddingHorizontal: 3 },
  body: { gap: 14, paddingTop: 2 },
  filterOption: { minHeight: KatchaUI.touchTarget, paddingHorizontal: 8, paddingVertical: 9 },
});
