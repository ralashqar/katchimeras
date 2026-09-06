import { useCallback, useState } from 'react';

const COMPANION_PANEL_MIN_HEIGHT = 148;
const COMPANION_PANEL_MAX_HEIGHT = 520;
const COMPANION_SHELL_RESERVED_HEIGHT = 208;

export const COMPANION_CHOICE_GAP = 9;
export const COMPANION_CHOICE_MIN_HEIGHT = 52;
export const COMPANION_PANEL_LAYOUT_DURATION_MS = 220;

export function companionChoiceColumnCount(viewportWidth: number, optionCount: number): 1 | 2 {
  return viewportWidth >= 360 && optionCount >= 4 ? 2 : 1;
}

export function estimatedCompanionChoiceContentHeight(
  optionCount: number,
  columnCount: 1 | 2 = 1,
): number {
  if (optionCount <= 0) return 190;
  const rowCount = Math.ceil(optionCount / columnCount);
  return Math.max(
    68,
    rowCount * COMPANION_CHOICE_MIN_HEIGHT
      + Math.max(0, rowCount - 1) * COMPANION_CHOICE_GAP
      + 26,
  );
}

export function useCompanionAdaptivePanel({
  chromeHeight,
  contentKey,
  estimatedContentHeight,
  safeAreaBottom,
  safeAreaTop,
  viewportHeight,
}: {
  chromeHeight: number;
  contentKey: string;
  estimatedContentHeight: number;
  safeAreaBottom: number;
  safeAreaTop: number;
  viewportHeight: number;
}) {
  const [measurement, setMeasurement] = useState({
    height: estimatedContentHeight,
    key: contentKey,
  });
  const contentHeight = measurement.key === contentKey
    ? measurement.height
    : estimatedContentHeight;
  const availableHeight = viewportHeight
    - safeAreaTop
    - safeAreaBottom
    - COMPANION_SHELL_RESERVED_HEIGHT;
  const maxHeight = Math.max(220, Math.min(COMPANION_PANEL_MAX_HEIGHT, availableHeight));
  const desiredHeight = contentHeight + chromeHeight;
  const panelHeight = Math.min(
    maxHeight,
    Math.max(COMPANION_PANEL_MIN_HEIGHT, desiredHeight),
  );
  const scrollable = desiredHeight > maxHeight + 1;
  const onContentHeightChange = useCallback((height: number) => {
    const nextHeight = Math.ceil(height);
    setMeasurement((current) => current.key === contentKey && current.height === nextHeight
      ? current
      : { height: nextHeight, key: contentKey });
  }, [contentKey]);

  return {
    maxHeight,
    onContentHeightChange,
    panelHeight,
    scrollable,
  };
}
