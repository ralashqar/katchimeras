import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { AppFontFamilies } from '@/constants/theme';
import { WISP_CARD_ART, WISP_RARITY } from '@/constants/wisp-card-art';
import { wispDefinition } from '@/constants/wisps';
import type { WispId } from '@/types/wisp';
import { WispArtwork } from './wisp-artwork';

export function WispCollectionCard({ wispId, width, owned = true, cardNumber, back = false }: {
  wispId: WispId; width: number; owned?: boolean; cardNumber?: number; back?: boolean;
}) {
  const definition = wispDefinition(wispId);
  const rarity = WISP_RARITY[definition.rarity];
  const height = width * 1.5;
  return <View accessible accessibilityLabel={back ? 'Unrevealed Wisp card' : `${definition.name}, ${rarity.label}, ${owned ? 'collected' : 'undiscovered'} Wisp card`} style={{ width, height }}>
    <View style={[styles.artWindow, { backgroundColor: back ? '#496243' : rarity.fill }]}>
      {back ? <Text style={{ color: '#F5DB91', fontSize: width * 0.28 }}>✦</Text> : <WispArtwork id={wispId} silhouette={!owned} size={width * 0.78} />}
    </View>
    <Image pointerEvents="none" source={WISP_CARD_ART.frame} contentFit="fill" style={StyleSheet.absoluteFill} transition={0} />
    <View style={styles.header}><Text numberOfLines={1} style={{ fontFamily: AppFontFamilies.manrope, fontWeight: '900', fontSize: width * 0.045, letterSpacing: 0.8, color: rarity.ink }}>{back ? 'WISP COLLECTION' : `${rarity.label.toUpperCase()}${cardNumber ? ` · ${String(cardNumber).padStart(2, '0')}` : ''}`}</Text></View>
    <View style={styles.nameplate}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: AppFontFamilies.fredokaBold, fontSize: width * 0.09, lineHeight: width * 0.11, color: '#4B3A25' }}>{back ? 'Little lights' : owned ? definition.name : '???'}</Text>
      <Text numberOfLines={1} style={{ fontFamily: AppFontFamilies.manrope, fontSize: width * 0.035, color: '#716447', marginTop: width * 0.015 }}>{back ? 'KATCHIMERAS' : owned ? `${definition.personality[0].toUpperCase()}${definition.personality.slice(1)} little visitor` : 'Waiting in the Mist'}</Text>
    </View>
    <View style={styles.medallion}><Text style={{ color: rarity.ink, fontSize: width * 0.077 }}>{back ? '✦' : rarity.symbol}</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  artWindow: { position: 'absolute', left: '7%', right: '7%', top: '12%', height: '64%', borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  header: { position: 'absolute', left: '17%', right: '10%', top: '5%', height: '6%', alignItems: 'center', justifyContent: 'center' },
  nameplate: { position: 'absolute', top: '78%', height: '11%', left: '10%', right: '10%', alignItems: 'center', justifyContent: 'center' },
  medallion: { position: 'absolute', top: '90.3%', left: '40%', width: '20%', height: '6.7%', alignItems: 'center', justifyContent: 'center' },
});
