import { ScrollView, useWindowDimensions } from 'react-native';
import { CompanionNarrativePanel } from './companion-narrative-panel';
import { CompanionChoiceList, type CompanionChoiceListOption } from './companion-choice-list';

export function MossproutNoticeChoices({ options, disabled = false, onSelect }: {
  options: readonly CompanionChoiceListOption[]; disabled?: boolean; onSelect: (id: string) => void;
}) {
  const { height } = useWindowDimensions();
  return <CompanionNarrativePanel accessibilityLabel="Noticing conversation" style={{ paddingTop: 8 }}>
    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: Math.max(180, height * 0.45) }}
      contentContainerStyle={{ paddingTop: 6, paddingBottom: 20 }}>
      <CompanionChoiceList options={options} disabled={disabled} onSelect={onSelect} />
    </ScrollView>
  </CompanionNarrativePanel>;
}
