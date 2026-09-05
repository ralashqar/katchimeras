import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KatchaSheet } from '@/components/katchadeck/ui/katcha-sheet';

import { ThemedText } from '@/components/themed-text';
import { Lantern } from '@/constants/theme';
import type { CosmeticType } from '@/types/cosmetics';
import type { CosmeticEntry } from '@/hooks/use-cosmetics';
import { DISCOVERY_CATALOG } from '@/utils/discoveries-catalog';
import { Meadow } from '@/constants/meadow-theme';

// The cosmetics shop — browse, buy (with Essence), and apply cosmetics (lantern
// colours in v1). Owned → tap to apply; purchasable → tap to buy then apply; locked
// → shows the Discovery that unlocks it. Purely expressive.

const TYPE_LABEL: Record<CosmeticType, string> = {
  worldTheme: 'World theme',
  lanternColour: 'Lantern colour',
  tileSkin: 'Tile skin',
  trailStyle: 'Trail style',
  particle: 'Particles',
};
const TYPE_ORDER: CosmeticType[] = ['worldTheme', 'lanternColour', 'tileSkin', 'trailStyle', 'particle'];

const DISCOVERY_NAME = new Map(DISCOVERY_CATALOG.map((def) => [def.id, def.name]));

type CosmeticsSheetProps = {
  entries: CosmeticEntry[];
  balance: number;
  onSelect: (type: CosmeticType, id: string) => void;
  onBuy: (id: string, cost: number) => void;
  onClose: () => void;
};

export function CosmeticsSheet({ entries, balance, onSelect, onBuy, onClose }: CosmeticsSheetProps) {

  return (
    <KatchaSheet header={{ eyebrow: 'Customize', title: 'Make your world yours', subtitle: 'Expressive changes never affect what hatches.' }} onRequestClose={onClose} size="tall" surface="night">
        <View style={styles.headRow}>
          <View style={styles.headText} />
          <View style={styles.balancePill}>
            <ThemedText style={styles.balanceMark} lightColor={Lantern.auroraTeal} darkColor={Lantern.auroraTeal}>
              ✦
            </ThemedText>
            <ThemedText style={styles.balanceValue} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {balance}
            </ThemedText>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {TYPE_ORDER.map((type) => {
            const group = entries.filter((entry) => entry.def.type === type);
            if (group.length === 0) return null;
            return (
              <View key={type} style={styles.section}>
                <ThemedText style={styles.sectionLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                  {TYPE_LABEL[type]}
                </ThemedText>
                <View style={styles.grid}>
                  {group.map((entry) => (
                    <CosmeticSwatch key={entry.def.id} entry={entry} onSelect={onSelect} onBuy={onBuy} />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
          <ThemedText style={styles.closeLabel} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Done
          </ThemedText>
        </Pressable>
    </KatchaSheet>
  );
}

function CosmeticSwatch({
  entry,
  onSelect,
  onBuy,
}: {
  entry: CosmeticEntry;
  onSelect: (type: CosmeticType, id: string) => void;
  onBuy: (id: string, cost: number) => void;
}) {
  const { def, owned, selected, buyable, affordable } = entry;
  const cost = def.essenceCost ?? 0;
  const unlockName = def.unlockDiscoveryId ? DISCOVERY_NAME.get(def.unlockDiscoveryId) : null;
  // owned → apply; buyable+affordable → buy; otherwise inert.
  const interactive = owned || (buyable && affordable);
  const handlePress = () => {
    if (owned) onSelect(def.type, def.id);
    else if (buyable && affordable) onBuy(def.id, cost);
  };

  const hint = owned
    ? def.description
    : buyable
      ? affordable
        ? 'Tap to buy'
        : 'Not enough Essence'
      : unlockName
        ? `Unlock: ${unlockName}`
        : 'Locked';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!interactive}
      onPress={handlePress}
      style={[styles.item, selected ? { borderColor: def.swatch } : null, !owned ? styles.itemLocked : null]}>
      <View style={[styles.swatch, { backgroundColor: def.swatch }, !owned ? styles.swatchLocked : null]}>
        {selected ? (
          <ThemedText style={styles.check}>✓</ThemedText>
        ) : !owned && !buyable ? (
          <ThemedText style={styles.lock}>🔒</ThemedText>
        ) : null}
      </View>
      <ThemedText style={styles.name} numberOfLines={1} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
        {def.name}
      </ThemedText>
      {!owned && buyable ? (
        <View style={styles.costRow}>
          <ThemedText
            style={styles.cost}
            lightColor={affordable ? Lantern.auroraTeal : Lantern.moon500}
            darkColor={affordable ? Lantern.auroraTeal : Lantern.moon500}>
            ✦ {cost}
          </ThemedText>
        </View>
      ) : null}
      <ThemedText style={styles.hint} numberOfLines={2} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
        {hint}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, elevation: 24, zIndex: 50 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 7, 15, 0.42)' },
  sheet: {
    backgroundColor: Meadow.overlay.sheetBg,
    borderColor: Meadow.overlay.sheetBorder,
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
    left: 12,
    maxHeight: '78%',
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 12,
    position: 'absolute',
    right: 12,
  },
  grabber: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, height: 4, marginBottom: 6, width: 38 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '800', lineHeight: 23 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headText: { flex: 1, gap: 2 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(125,232,205,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(125,232,205,0.28)',
  },
  balanceMark: { fontSize: 13, fontWeight: '900' },
  balanceValue: { fontSize: 14, fontWeight: '800' },
  costRow: { flexDirection: 'row', alignItems: 'center' },
  cost: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  scroll: { gap: 16, paddingTop: 10, paddingBottom: 4 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  item: {
    width: '30%',
    minWidth: 96,
    flexGrow: 1,
    alignItems: 'center',
    gap: 5,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  itemLocked: { opacity: 0.65 },
  swatch: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 14px rgba(255,255,255,0.18)',
  },
  swatchLocked: { opacity: 0.5 },
  lock: { fontSize: 16 },
  check: { fontSize: 18, fontWeight: '900', color: '#0B0712' },
  name: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  close: { alignSelf: 'center', paddingTop: 6 },
  closeLabel: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
});
