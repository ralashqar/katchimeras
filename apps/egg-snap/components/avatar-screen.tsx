import { CHARACTERS, EXPRESSIONS } from '../data/characters';
import { CHARACTER_ART } from '../data/character-art.gen';
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AvatarCustomizer } from '@incubator/avatar/customizer';
import { useProfile } from '../state/provider';
import { repository } from '../state/repository';
import { customize, EGGS, selectEgg, canClaimCharacter, claimCharacter } from '../state/adventure';
import { BODIES, FACES } from '../data/art';
import { HATS, HELD } from '../data/accessories';
import { Scene } from './scene';
import { Egg } from './egg';
import { Button, Copy, Heading } from './ui';

export default function AvatarScreen() {
  const { profile: p, act, error } = useProfile();
  const [category, setCategory] = useState('body');
  const [busy, setBusy] = useState(false);
  const [previewFace, setPreviewFace] = useState('neutral');
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  if (!p?.adventure) return null;
  const a = p.adventure;
  const outfit = a.appearances[a.activeEgg];
  const egg = EGGS.find(e => e.id === a.activeEgg)!;
  const options = category === 'body' ? Object.entries(BODIES).map(([id, body]) => ({ id, name: body.name, owned: p.skins.includes(id) || id === egg.skin, preview: <Egg skin={id} size={48} paused /> }))
    : category === 'face' ? Object.entries(FACES).map(([id, face]) => ({ id, name: id, owned: true, preview: <Image source={face.source} style={{ width: 48, height: 48 }} contentFit="contain" /> }))
    : [{ id: null, name: 'None', owned: true, preview: undefined }, ...Object.entries(category === 'hat' ? HATS : HELD).map(([id, item]) => ({ id, name: item.name, owned: id !== 'tiny-golden-crown' || a.fragments.includes('captain'), preview: <Image source={item.source} style={{ width: 48, height: 48 }} contentFit="contain" /> }))];
  const change = async (work: () => ReturnType<typeof repository.load>) => { if (busy) return; setBusy(true); try { await act(work); } catch {} finally { setBusy(false); } };
  return <Scene><View style={{ flex: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingHorizontal: 18, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Heading small>Your eggs</Heading><Button secondary onPress={() => router.back()}>Done</Button></View>
    <View style={{ alignItems: 'center' }}><Egg size={Math.min(210, height * .24)} skin={outfit.skin} characterId={a.activeEgg === 'pip' ? undefined : a.activeEgg} face={a.activeEgg === 'pip' ? outfit.face : previewFace} hat={outfit.hat} held={outfit.held} /><Heading small>{egg.name}</Heading><Copy>{egg.line}</Copy></View>
    <ScrollView horizontal style={{maxHeight: 58}} contentContainerStyle={{gap: 8}}>{EGGS.filter(e => a.eggs.includes(e.id)).map(e => <Button key={e.id} secondary={e.id !== a.activeEgg} disabled={busy} onPress={() => {setPreviewFace('neutral'); void change(() => repository.update(value => selectEgg(value, e.id)));}}>{e.name}</Button>)}</ScrollView>
    {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
    <ScrollView style={{flex: 1}} contentContainerStyle={{gap: 12}}>
    {a.activeEgg === 'pip' ? <View pointerEvents={busy ? 'none' : 'auto'} style={{height: 350, padding: 14, backgroundColor: '#FFF8E9', borderRadius: 26}}><AvatarCustomizer category={category} onCategory={setCategory} selected={category === 'body' ? outfit.skin : category === 'face' ? outfit.face : category === 'hat' ? outfit.hat : outfit.held} options={options} onSelect={id => void change(() => repository.update(value => customize(value, { [category === 'body' ? 'skin' : category]: id })))} /></View>
      : <View style={{gap: 8}}><Copy>Made for adventure. Preview an expression:</Copy><View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>{EXPRESSIONS.map(id => <Button key={id} secondary={previewFace !== id} onPress={() => setPreviewFace(id)}>{id}</Button>)}</View></View>}
    <Heading small>Scramblewood friends</Heading>
    <Copy>{a.fragments.includes('captain') ? 'Defeated rivals can join your collection.' : 'Pollen joins on the trail. Defeat Captain Crack to recruit your other rivals.'}</Copy>
    <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>{CHARACTERS.map(c => <View key={c.id} style={{width: '47%', padding: 10, gap: 6, alignItems: 'center', borderRadius: 20, backgroundColor: '#18382F'}}>
      <Image source={CHARACTER_ART[c.id]?.thumbnail} style={{width: 96, height: 96}} contentFit="contain" accessibilityLabel={c.name} />
      <Copy>{c.name}</Copy><Copy>{c.title}</Copy>
      <Button secondary disabled={busy || !canClaimCharacter(p, c.id)} onPress={() => void change(() => repository.update(value => claimCharacter(value, c.id)))}>{a.eggs.includes(c.id) ? 'Collected' : canClaimCharacter(p, c.id) ? 'Invite' : 'Meet on the trail'}</Button>
    </View>)}</View>
    </ScrollView>
    <Button secondary onPress={() => router.push('/collection')}>Shells & companions</Button>
  </View></Scene>;
}
