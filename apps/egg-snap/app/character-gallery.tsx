import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHARACTERS, EXPRESSIONS } from '../data/characters';
import { CHARACTER_ART } from '../data/character-art.gen';
import { Image } from 'expo-image';
import { FocusedScreen } from '../components/focused-screen';
import { Egg } from '../components/egg';
import { Button, Copy, Heading } from '../components/ui';
function Gallery() {
  const [id, setId] = useState<string>('tuck'), [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [anchors, setAnchors] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {if (!playing) return; const timer = setInterval(() => setIndex(n => (n+1)%EXPRESSIONS.length), 850); return () => clearInterval(timer);},[playing]);
  if (!__DEV__) return <Button onPress={() => router.dismissTo('/')}>Home</Button>;
  return <ScrollView style={{flex: 1, backgroundColor: '#214438'}} contentContainerStyle={{padding: 16, paddingTop: insets.top+16, gap: 14}}>
    <Heading small>Character gallery</Heading><Button secondary onPress={() => router.replace('/dev')}>Done</Button>
    <View style={{flexDirection:'row', flexWrap:'wrap',gap:6}}>{CHARACTERS.map(c => <Button key={c.id} secondary={id !== c.id} onPress={() => setId(c.id)}>{c.name}</Button>)}</View>
    <View style={{alignSelf:'center', width:256,height:256,backgroundColor:'#DAE4CD',borderRadius:20}}>
      <Egg key={id} characterId={id} size={256} face={EXPRESSIONS[index]} paused />
      {anchors && <View pointerEvents="none" style={{position:'absolute',inset:0,borderWidth:1,borderColor:'#FF5070'}}><View style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,backgroundColor:'#FF5070'}}/><View style={{position:'absolute',top:'90%',left:0,right:0,height:1,backgroundColor:'#FF5070'}}/></View>}
    </View>
    <Copy>{EXPRESSIONS[index]} · {CHARACTER_ART[id] ? 'Published layered art' : 'Art in review'}</Copy>
    <View style={{flexDirection:'row',gap:8}}><Button onPress={() => setPlaying(!playing)}>{playing ? 'Pause sequence' : 'Play expressions'}</Button><Button secondary onPress={() => setAnchors(!anchors)}>Anchors</Button></View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{EXPRESSIONS.map((face,n) => <Button key={face} secondary={n!==index} onPress={() => {setPlaying(false);setIndex(n);}}>{face}</Button>)}</View>
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>{[48,96,160].map(size => <Egg key={size} characterId={id} size={size} face={EXPRESSIONS[index]} paused />)}</View>
    <Copy>Body alone</Copy><Image source={CHARACTER_ART[id]?.body} style={{width:160,height:160}} contentFit="contain"/>
  </ScrollView>;
}
export default function CharacterGallery() {return <FocusedScreen><Gallery /></FocusedScreen>;}
