import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getCreatureVisual } from '@/game/days';
import type { HomeDayRecord } from '@/types/home';
import { formatMeetingLabel } from '@/utils/daily-card';
import { resolveCreatureVariantSource } from '@/utils/creature-variant';

type ShareableCardDay = HomeDayRecord & {
  creature: NonNullable<HomeDayRecord['creature']>;
  card: NonNullable<HomeDayRecord['card']>;
};

type MemoryPostcardProps = { day: ShareableCardDay };

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1536;

export const MemoryPostcard = forwardRef<View, MemoryPostcardProps>(function MemoryPostcard({ day }, ref) {
  const { card } = day;
  const visual = getCreatureVisual(card.visualKey);
  const source = resolveCreatureVariantSource(card.visualKey, card.variantCell) ?? visual.source;
  const facets = card.facets ? ['mood', 'energy', 'sleep', 'place', 'social'].map((key) => card.facets![key as keyof typeof card.facets]) : [
    { label: 'Mood', value: card.state.tone },
    { label: 'Energy', value: card.state.vitality },
    { label: 'Sleep', value: formatSleep(day.sleep?.totalSleepMinutes, day.sleep?.quality) },
    { label: 'Place', value: card.placeLabel ?? 'Not logged' },
    { label: 'Social', value: 'Not noted' },
  ];
  const facts = [
    { label: card.dayFacts?.stepsLabel ?? 'Steps', value: formatSteps(card.dayFacts?.steps ?? day.stepsCount) },
    { label: 'Highlight', value: card.dayFacts?.highlight ?? card.memorySpark?.caption ?? 'A quiet day' },
    { label: 'Bonus trait', value: card.dayFacts?.bonusTrait?.label ?? card.traits[0]?.label ?? 'One of a kind' },
  ];

  return (
    <View collapsable={false} ref={ref} style={styles.captureFrame}>
      <LinearGradient colors={card.treatment.palette} style={[styles.card, { borderColor: card.accentColor }]}>
        <View style={[styles.innerBorder, { borderColor: `${card.accentColor}88` }]} />
        <View style={styles.header}>
          <Text style={styles.brand}>KATCHIMERAS</Text>
          <View style={[styles.rarityBadge, { backgroundColor: card.accentColor }]}>
            <Text style={styles.rarity}>{card.rarity.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.date}>{formatDate(card.isoDate)}{card.placeLabel ? ` · ${card.placeLabel}` : ''}</Text>

        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.name}>{card.creatureName.toUpperCase()}</Text>
          <Text style={styles.epithet}>{card.epithet}</Text>
        </View>

        <View style={[styles.artWindow, { backgroundColor: `${card.accentColor}22` }]}>
          <View style={[styles.halo, { backgroundColor: `${card.accentColor}30` }]} />
          <Image contentFit="contain" source={source} style={styles.creature} transition={0} />
        </View>

        <Text numberOfLines={2} style={styles.story}>✦ {card.storyLine ?? card.state.label} ✦</Text>

        <View style={styles.stateBlock}>
          <Text style={styles.sectionLabel}>STATE</Text>
          <Text style={styles.state}>{card.state.label}</Text>
        </View>

        <View style={styles.traits}>
          {card.traits.map((trait) => (
            <View key={trait.id} style={styles.trait}>
              <View style={[styles.traitDot, { backgroundColor: card.accentColor }]} />
              <Text style={styles.traitText}>{trait.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.metrics}>
          {facets.map((metric) => (
            <View key={metric.label} style={styles.metric}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.facts}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text style={styles.metricLabel}>{fact.label}</Text>
              <Text numberOfLines={2} style={styles.factValue}>{fact.value}</Text>
            </View>
          ))}
        </View>

        {card.memorySpark ? (
          <View style={styles.memory}>
            <View style={styles.memoryCopy}>
              <Text style={styles.memoryLabel}>MEMORY SPARK</Text>
              <Text numberOfLines={3} style={styles.memoryText}>“{card.memorySpark.caption}”</Text>
            </View>
            {card.memorySpark.photoUri ? <Image contentFit="cover" source={card.memorySpark.photoUri} style={styles.memoryPhoto} transition={0} /> : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{formatMeetingLabel(card)}</Text>
          <Text style={styles.footerBrand}>Your life became your deck.</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSteps(value: number): string {
  return value.toLocaleString();
}

function formatSleep(minutes: number | undefined, quality: string | undefined): string {
  if (minutes) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return quality === 'good' ? 'Good' : quality === 'low' ? 'Low' : quality === 'normal' ? 'Steady' : '—';
}

const styles = StyleSheet.create({
  captureFrame: { backgroundColor: '#171109', width: CARD_WIDTH },
  card: { borderRadius: 60, borderWidth: 5, height: CARD_HEIGHT, overflow: 'hidden', paddingHorizontal: 64, paddingVertical: 58 },
  innerBorder: { ...StyleSheet.absoluteFillObject, borderRadius: 52, borderWidth: 2, margin: 14 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  brand: { color: '#665438', fontFamily: 'Manrope', fontSize: 24, fontWeight: '800', letterSpacing: 5 },
  rarityBadge: { borderRadius: 999, paddingHorizontal: 26, paddingVertical: 12 },
  rarity: { color: '#FFF9EC', fontFamily: 'Manrope', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  date: { color: '#806C4B', fontFamily: 'Manrope', fontSize: 23, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  titleBlock: { alignItems: 'center', marginTop: 20 },
  name: { color: '#3B2F20', fontFamily: 'InstrumentSerif', fontSize: 78, lineHeight: 84, textAlign: 'center' },
  epithet: { color: '#6F593B', fontFamily: 'InstrumentSerif', fontSize: 31, fontStyle: 'italic', marginTop: 2 },
  artWindow: { alignItems: 'center', borderRadius: 38, height: 470, justifyContent: 'center', marginTop: 24, overflow: 'hidden' },
  halo: { borderRadius: 999, height: 390, position: 'absolute', width: 390 },
  creature: { height: 450, width: 700 },
  story: { color: '#5A472F', fontFamily: 'InstrumentSerif', fontSize: 27, fontStyle: 'italic', lineHeight: 34, marginTop: 16, textAlign: 'center' },
  stateBlock: { alignItems: 'center', marginTop: 18 },
  sectionLabel: { color: '#8B7450', fontFamily: 'Manrope', fontSize: 17, fontWeight: '900', letterSpacing: 3 },
  state: { color: '#443521', fontFamily: 'Manrope', fontSize: 35, fontWeight: '800', marginTop: 5 },
  traits: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 17 },
  trait: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.48)', borderRadius: 999, flexDirection: 'row', gap: 9, paddingHorizontal: 20, paddingVertical: 13 },
  traitDot: { borderRadius: 999, height: 11, width: 11 },
  traitText: { color: '#5A472F', fontFamily: 'Manrope', fontSize: 20, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: 12, marginTop: 20 },
  metric: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 22, flex: 1, gap: 3, paddingVertical: 14 },
  metricLabel: { color: '#8B7450', fontFamily: 'Manrope', fontSize: 15, fontWeight: '800', textTransform: 'uppercase' },
  metricValue: { color: '#443521', fontFamily: 'InstrumentSerif', fontSize: 22, fontWeight: '600', textAlign: 'center' },
  facts: { flexDirection: 'row', gap: 12, marginTop: 15 },
  fact: { backgroundColor: 'rgba(255,255,255,0.36)', borderRadius: 22, flex: 1, gap: 5, justifyContent: 'center', minHeight: 100, paddingHorizontal: 13, paddingVertical: 12 },
  factValue: { color: '#443521', fontFamily: 'InstrumentSerif', fontSize: 22, lineHeight: 27, textAlign: 'center' },
  memory: { alignItems: 'center', backgroundColor: 'rgba(54,43,28,0.9)', borderRadius: 28, flexDirection: 'row', gap: 20, marginTop: 20, minHeight: 130, padding: 22 },
  memoryCopy: { flex: 1 },
  memoryLabel: { color: '#E6C476', fontFamily: 'Manrope', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  memoryText: { color: '#FFF4DF', fontFamily: 'InstrumentSerif', fontSize: 27, fontStyle: 'italic', lineHeight: 34, marginTop: 7 },
  memoryPhoto: { borderRadius: 17, height: 92, width: 92 },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' },
  footerText: { color: '#655238', fontFamily: 'Manrope', fontSize: 20, fontWeight: '700' },
  footerBrand: { color: '#806C4B', fontFamily: 'InstrumentSerif', fontSize: 23, fontStyle: 'italic' },
});
