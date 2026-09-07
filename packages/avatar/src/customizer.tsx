import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

export type CustomizerOption = { id: string | null; name: string; owned: boolean; preview?: ReactNode };
export function AvatarCustomizer({ category, onCategory, selected, options, onSelect }: {
  category: string;
  onCategory: (id: string) => void;
  selected: string | null;
  options: readonly CustomizerOption[];
  onSelect: (id: string | null) => void;
}) {
  return <View style={{ gap: 14, flex: 1 }}>
    <AvatarCategoryTabs category={category} onCategory={onCategory} />
    <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 24 }}>
      {options.map(option => <AvatarOptionCard key={option.id ?? 'none'} name={option.name} owned={option.owned} selected={selected === option.id} disabled={!option.owned} onPress={() => onSelect(option.id)} preview={option.preview} />)}
    </ScrollView>
  </View>;
}

export function AvatarCategoryTabs({ category, onCategory }: { category: string; onCategory: (id: string) => void }) {
  return <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6 }}>
    {(['body', 'face', 'hat', 'held'] as const).map((id, index) => <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: category === id }} onPress={() => onCategory(id)} style={{ flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: category === id ? '#E7D8B6' : '#FAF3E4' }}>
      <Text style={{ color: '#243C30', textAlign: 'center', fontWeight: '700' }}>{['Body', 'Face', 'Hats', 'Held'][index]}</Text>
    </Pressable>)}
  </View>;
}

/** Shared selectable tile; hosts retain their inventory, pricing and virtualized grid. */
export function AvatarOptionCard({ name, owned, selected, disabled, onPress, preview, label, style }: {
  name: string; owned: boolean; selected: boolean; disabled?: boolean;
  onPress: () => void; preview: ReactNode; label?: ReactNode;
  style?: ComponentProps<typeof Pressable>['style'];
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${name}${selected ? ', selected' : ''}${owned ? '' : ', locked'}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={style ?? { width: '23%', minHeight: 92, padding: 8, borderRadius: 14, backgroundColor: selected ? '#D9E6B6' : '#F4EDD9', opacity: owned ? 1 : .4, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    {preview}{label ?? <Text style={{ color: '#243C30', textAlign: 'center', fontSize: 12 }}>{name}</Text>}
  </Pressable>;
}
