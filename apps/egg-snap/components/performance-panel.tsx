import { memo, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { CombatPresentation } from '../game/combat-presentation';
import type { EffectQuality } from '../game/effect-quality';
import type { CombatBurstData, CombatVolleyData } from './combat-volley';
import { Copy } from './ui';

/** One update per second in its own subtree. No frame logging or whole-screen diagnostic commits. */
export const PerformancePanel = memo(function PerformancePanel({presentation, volleys, bursts, paused}: {
  presentation: CombatPresentation; volleys: readonly CombatVolleyData[]; bursts: readonly CombatBurstData[]; paused: boolean;
}) {
  const [report, setReport] = useState(() => presentation.performance.report());
  const [quality, setQuality] = useState<EffectQuality | null>(null);
  useEffect(() => {
    presentation.performance.cells(volleys.reduce((n,v) => n+v.bullets.length,0)+bursts.reduce((n,v) => n+v.cells.length,0));
  }, [presentation, volleys, bursts]);
  useEffect(() => {
    const timer = setInterval(() => setReport(presentation.performance.report()), 1000);
    return () => clearInterval(timer);
  }, [presentation]);
  return <View style={{position:'absolute', top: 86, left: 6, zIndex: 400, padding: 5, borderRadius: 8, backgroundColor:'#102016DE', maxWidth: 170}}>
    <Copy style={{fontSize: 9}}>JS frame p95 {report.p95FrameMs.toFixed(1)}ms · &gt;25 {report.over25Percent.toFixed(1)}%</Copy>
    <Copy style={{fontSize: 9}}>UI &gt;25 {report.uiOver25Percent.toFixed(1)}% · max {report.uiMaxMs.toFixed(0)}ms</Copy>
    <Copy style={{fontSize: 9}}>Battle commits {report.battleCommits} · cells {report.activeCells}/{report.peakCells}</Copy>
    <Copy style={{fontSize: 9}}>Sim max {report.simulationMaxMs.toFixed(1)}ms · {(presentation.current.elapsed/1000).toFixed(0)}s{paused ? ' · paused' : ''}</Copy>
    <Pressable accessibilityRole="button" accessibilityLabel="Change effect quality" onPress={() => {
      const tiers = [null, 'high', 'balanced', 'low'] as const;
      const next = tiers[(tiers.indexOf(quality)+1)%tiers.length];
      presentation.quality.override = next; setQuality(next);
    }} style={{paddingVertical: 7}}>
      <Copy style={{fontSize: 10}}>Effects: {quality ?? `auto (${presentation.quality.current})`}</Copy>
    </Pressable>
  </View>;
});
