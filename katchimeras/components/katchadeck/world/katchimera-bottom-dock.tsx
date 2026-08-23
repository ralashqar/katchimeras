import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppFontFamilies } from '@/constants/theme';
import { KATCHIMERA_NAV_ART, type KatchimeraNavArtId } from '@/constants/katchimera-nav-art';

export type KatchimeraBottomDockItem = {
  disabled?: boolean;
  id: KatchimeraNavArtId;
  label: string;
  onPress: () => void;
};

export function KatchimeraBottomDock({
  activeId,
  disabled = false,
  featuredId,
  items,
}: {
  activeId?: KatchimeraNavArtId;
  disabled?: boolean;
  featuredId?: KatchimeraNavArtId;
  items: readonly KatchimeraBottomDockItem[];
}) {
  return (
    <View accessibilityLabel="Katchimera navigation" style={styles.dock}>
      <View pointerEvents="none" style={styles.innerRim} />
      {items.map((item, index) => {
        const itemDisabled = disabled || Boolean(item.disabled);
        const active = item.id === activeId;
        const featured = !active && item.id === featuredId;
        return (
          <View key={item.id} style={styles.itemFrame}>
            {index > 0 ? <View pointerEvents="none" style={styles.divider} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: itemDisabled, selected: active }}
              disabled={itemDisabled}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.action,
                featured && styles.actionFeatured,
                active && styles.actionActive,
                itemDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Image
                accessibilityIgnoresInvertColors
                contentFit="contain"
                source={KATCHIMERA_NAV_ART[item.id]}
                style={[styles.icon, item.id === 'skins' && styles.wideIcon]}
                transition={0}
              />
              <ThemedText
                numberOfLines={1}
                style={[styles.label, (active || featured) && styles.labelSelected]}
                lightColor={active || featured ? '#496B25' : '#654721'}
                darkColor={active || featured ? '#496B25' : '#654721'}>
                {item.label}
              </ThemedText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    alignItems: 'stretch',
    backgroundColor: '#F8E9C8',
    borderColor: '#C99236',
    borderCurve: 'continuous',
    borderRadius: 22,
    borderWidth: 2,
    boxShadow: '0 7px 18px rgba(70,42,17,0.24), inset 0 2px 0 rgba(255,255,255,0.9), inset 0 -3px 0 rgba(185,123,38,0.2)',
    flexDirection: 'row',
    minHeight: 78,
    overflow: 'hidden',
    padding: 5,
    position: 'relative',
  },
  innerRim: {
    ...StyleSheet.absoluteFillObject,
    borderColor: 'rgba(255,255,255,0.72)',
    borderCurve: 'continuous',
    borderRadius: 19,
    borderWidth: 1,
    margin: 2,
  },
  itemFrame: { flex: 1, minWidth: 0, position: 'relative' },
  divider: { backgroundColor: 'rgba(157,105,37,0.26)', bottom: 11, left: 0, position: 'absolute', top: 11, width: 1, zIndex: 2 },
  action: { alignItems: 'center', borderColor: 'transparent', borderCurve: 'continuous', borderRadius: 17, borderWidth: 1, flex: 1, gap: 1, justifyContent: 'center', minHeight: 66, minWidth: 0, paddingHorizontal: 2 },
  actionFeatured: { backgroundColor: '#FFE7A0', borderColor: 'rgba(199,139,41,0.38)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86), 0 2px 5px rgba(124,77,19,0.12)' },
  actionActive: { backgroundColor: '#F7D878', borderColor: 'rgba(167,104,22,0.48)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.78), inset 0 -2px 0 rgba(169,105,20,0.14)' },
  icon: { height: 40, width: 40 },
  wideIcon: { width: 46 },
  label: { fontFamily: AppFontFamilies.fredokaBold, fontSize: 12, fontWeight: '700', letterSpacing: -0.15, lineHeight: 14, textAlign: 'center' },
  labelSelected: { fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.5 },
});
