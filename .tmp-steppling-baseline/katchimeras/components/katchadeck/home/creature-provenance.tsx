import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { encounterLiveCast } from '@/constants/encounter-cast';
import { Lantern } from '@/constants/theme';
import { getCreatureVisual } from '@/game/days';
import type { LocalCreatureRecord } from '@/types/home';

// seedId → the human category label the hatch engine uses ("Coffee shop").
const SEED_LABEL = new Map(encounterLiveCast.map((entry) => [entry.seedId, entry.categoryLabel] as [string, string]));

// seedId → a glyph for the "summoned it" line. Unmapped seeds fall back to sparkles.
const SEED_ICON: Record<string, IconSymbolName> = {
  coffee_shop: 'cup.and.saucer.fill',
  bakery: 'fork.knife',
  feast: 'fork.knife',
  park: 'leaf.fill',
  beach: 'water.waves',
  run_session: 'figure.run',
  gym_day: 'dumbbell.fill',
  high_steps_day: 'figure.walk',
  errand_loop: 'cart.fill',
  home_evening: 'moon.stars.fill',
  social_gathering: 'person.2.fill',
  celebration: 'party.popper.fill',
  live_music: 'music.note',
  cinema: 'film.fill',
  creative_day: 'paintbrush.fill',
  travel_day: 'mappin.and.ellipse',
  little_one: 'heart.fill',
  dog_companion: 'pawprint.fill',
};

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

const RARITY_COLOR: Record<string, string> = {
  common: Lantern.moon500,
  rare: '#7DE8CD',
  epic: '#A78BFA',
  legendary: '#FFC36B',
};

// The "why this creature" payoff: the day-signal that summoned it, the odds it
// was drawn at, the living reason for its rarity, and the ones that got away —
// all read straight from what the hatch persisted on the creature.
export function CreatureProvenance({ creature }: { creature: LocalCreatureRecord }) {
  const seed = creature.birthSignals?.[0];
  const seedLabel = seed ? SEED_LABEL.get(seed) ?? humanize(seed) : null;
  const seedIcon: IconSymbolName = seed ? SEED_ICON[seed] ?? 'sparkles' : 'sparkles';
  const pct = creature.pickProbability != null ? Math.round(creature.pickProbability * 100) : null;
  const showReason = Boolean(creature.rarityReason) && creature.rarity !== 'common';
  const echoes = (creature.fieldEchoes ?? []).slice(0, 3);
  const accent = creature.accentColor;
  const journalReasons = creature.hatchDecision?.candidates
    .find((candidate) => candidate.selected)
    ?.contributions
    .filter((item, index, rows) => rows.findIndex((row) => row.explanation === item.explanation) === index)
    .slice(0, 2) ?? [];

  if (!seedLabel && echoes.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <ThemedText type="onboardingLabel" style={styles.label} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
        How you caught it
      </ThemedText>

      {seedLabel ? (
        <View style={styles.summonRow}>
          <View style={[styles.summonIcon, { backgroundColor: `${accent}22` }]}>
            <IconSymbol color={accent} name={seedIcon} size={18} />
          </View>
          <View style={styles.summonText}>
            <ThemedText style={styles.summonLabel} lightColor={Lantern.moon50} darkColor={Lantern.moon50}>
              {seedLabel}
            </ThemedText>
            {pct != null ? (
              <ThemedText style={styles.summonMeta} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
                drawn at {pct}%
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : null}

      {journalReasons.length > 0 ? (
        <View style={styles.reasonList}>
          {journalReasons.map((reason) => (
            <View key={`${reason.journalRecordId}:${reason.routeKey}`} style={styles.reasonRow}>
              <IconSymbol color={reason.keyMoment ? Lantern.ember300 : Lantern.moon300} name={reason.keyMoment ? 'star.fill' : 'book.closed.fill'} size={14} />
              <ThemedText style={styles.journalReason} lightColor={Lantern.moon300} darkColor={Lantern.moon300}>
                {reason.keyMoment ? `Your key moment: ${reason.explanation}` : `Your journal: ${reason.explanation}`}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {showReason ? (
        <ThemedText style={styles.reason} lightColor={Lantern.ember300} darkColor={Lantern.ember300}>
          Only from {creature.rarityReason}
        </ThemedText>
      ) : null}

      {echoes.length > 0 ? (
        <View style={styles.echoBlock}>
          <ThemedText style={styles.echoHeader} lightColor={Lantern.moon500} darkColor={Lantern.moon500}>
            Almost caught
          </ThemedText>
          {echoes.map((echo) => {
            const source = getCreatureVisual(echo.visualKey).source;
            const rarityColor = RARITY_COLOR[echo.rarity] ?? Lantern.moon500;
            return (
              <View key={echo.speciesId} style={styles.echoRow}>
                <View style={styles.echoFace}>
                  {source ? <Image contentFit="contain" source={source} style={styles.echoImage} transition={0} /> : null}
                </View>
                <ThemedText style={styles.echoName} lightColor={Lantern.moon50} darkColor={Lantern.moon50} numberOfLines={1}>
                  {echo.name}
                </ThemedText>
                <ThemedText style={[styles.echoMeta, { color: rarityColor }]} numberOfLines={1}>
                  {echo.rarity} · {Math.round(echo.probability * 100)}%
                </ThemedText>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(215, 228, 255, 0.1)',
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  label: {
    fontSize: 11,
  },
  summonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  summonIcon: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  summonText: {
    flexShrink: 1,
    gap: 1,
  },
  summonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  summonMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  reason: {
    fontSize: 13,
    fontWeight: '700',
  },
  reasonList: { gap: 7 },
  reasonRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  journalReason: { flex: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  echoBlock: {
    borderTopColor: 'rgba(215, 228, 255, 0.1)',
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
  },
  echoHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  echoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  echoFace: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 999,
    height: 30,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 30,
  },
  echoImage: {
    height: 26,
    width: 26,
  },
  echoName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  echoMeta: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
