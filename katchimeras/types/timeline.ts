import type { ImageSourcePropType } from 'react-native';

export type TimelineCreatureVisual =
  | {
      kind?: 'creature';
      id: string;
      name: string;
      accent: string;
      imageSource: ImageSourcePropType;
    }
  | {
      kind: 'egg';
      id: string;
      name: string;
      accent: string;
      imageSource?: ImageSourcePropType;
      coreColor?: string;
      shimmer?: boolean;
      intensity?: number;
    };

export type TimelineDayMemory = {
  title: string;
  body: string;
  timeLabel: string;
  location: string;
  tag: string;
  metrics: string;
};

export type TimelineDayEntry = {
  id: string;
  dayLabel: string;
  dateLabel: string;
  cardTitle: string;
  cardCue: string;
  summary: string;
  creature: TimelineCreatureVisual;
  memory: TimelineDayMemory;
};

export type TimelineTomorrowState = {
  id: 'tomorrow';
  dayLabel: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  accent: string;
};

export type TimelineSelectableId = TimelineDayEntry['id'] | TimelineTomorrowState['id'];

export type TimelineShiftMode = 'hidden' | 'right-in' | 'center' | 'tomorrow';

export type ScriptedTimelineState = {
  visibleEntryIds?: readonly string[];
  focusedEntryId?: TimelineSelectableId;
  showMemoryCard?: boolean;
  showTomorrowEgg?: boolean;
  activityCardsVisible?: readonly string[];
  activityCardsEnteringFrom?: 'right' | 'left' | 'none';
  transformingEntryId?: string;
  revealedCreatureId?: string;
  highlightedEntryId?: string;
  memoryExpanded?: boolean;
  timelineShift?: TimelineShiftMode;
  tomorrowRevealProgress?: number;
};
