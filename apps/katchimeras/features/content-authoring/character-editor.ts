import { FEASTLE_HATCH_PROFILE } from '@/constants/feastle-hatch-profile';
import { FEASTLE_CHAPTER } from '@/constants/companion-journey-chapters/feastle';
import { FEASTLE_HATCHABLE } from '@/constants/hatchable-companions/feastle';
import { MOSSPROUT_CHAPTER } from '@/constants/companion-journey-chapters/mossprout';
import { STEPPLING_CHAPTER } from '@/constants/companion-journey-chapters/steppling';
import { STEPPLING_HATCHABLE } from '@/constants/hatchable-companions/steppling';
import { BARISTABBIT_HATCHABLE } from '@/constants/hatchable-companions/baristabbit';
import { PETALIMP_BLOOM_CAMPAIGN } from '@/constants/island-campaigns/petalimp-bloom';
import { MOSSPROUT_NATURE_ISLANDS_BUNDLED } from '@/constants/mossprout-nature-islands';
import { MOSSPROUT_OLD_GROVE } from '@/constants/story-tiles/mossprout-old-grove';
import { MOSSPROUT_DAILY } from '@/constants/companion-daily/mossprout';
import { companionConversationDefinitionsBundled } from '@/constants/companion-conversations-v2';
import { MERGE_ITEM_CATALOG } from '@/constants/merge-world-catalog';
import { journeyEpisodeConversation } from '@/constants/companion-journey-chapters/episode-conversation';
import { missionWindow } from '@/features/mission-mechanics/board-window';
import type { CompanionJourneyChapterDefinition } from '@/types/companion-journey-chapter';
import type { AuthorField } from './journey-draft';

export const CHARACTER_IDS = ['mossprout','steppling','petalimp','baristabbit','feastle'] as const;
export type CharacterId = typeof CHARACTER_IDS[number];
export type CharacterDraft = { kind:'character-draft'; version:1; character:CharacterId; sourceRevision:string; name:string; edits:Record<string,string|number>; art:Record<string,string> };
type RecordData = Record<string, unknown>;
type Section = { path:string; title:string };
const isObject=(v:unknown):v is RecordData=>!!v&&typeof v==='object'&&!Array.isArray(v);
const linked=(chapter:CompanionJourneyChapterDefinition)=>companionConversationDefinitionsBundled.filter(c=>chapter.episodes.some(e=>e.conversationId===c.id));
const sources:Record<CharacterId,RecordData>={
  mossprout:{chapter:MOSSPROUT_CHAPTER,conversations:linked(MOSSPROUT_CHAPTER),tile:MOSSPROUT_OLD_GROVE,daily:MOSSPROUT_DAILY},
  steppling:{chapter:STEPPLING_CHAPTER,hatchable:STEPPLING_HATCHABLE},
  petalimp:{campaign:PETALIMP_BLOOM_CAMPAIGN,island:MOSSPROUT_NATURE_ISLANDS_BUNDLED.find(i=>i.id==='bloom-garden')!},
  baristabbit:{hatchable:BARISTABBIT_HATCHABLE},
  feastle:{chapter:FEASTLE_CHAPTER,hatchable:FEASTLE_HATCHABLE,hatchProfile:FEASTLE_HATCH_PROFILE},
};
const textKeys=new Set('title name shortName purpose text prompt message label reply description reveal foreshadow complete helperText body eyebrow opening endMessage closing summary handoffLabel actionLabel actionTitle readingTitle chapterTitle gardenActionLabel restingLine idleLine questionSubtitle subtitle permissionTitle permissionBody analysingLine openingConclusion returnLine resolutionLine closingLine revealTitle thanks'.split(' '));
const copyContainers=new Set(['copy','lines','markerLines','guides','handoffs','callbackLine','actionLabels','stateLabels','speech','replies']);
const protectedKeys=new Set(['id','kind','version','familyId','chapterId','conversationId','storageKey','runId','flowId','when','variantsWhen','fact','traits','wispAffinity','migrations','tags','styles','categoryIds','coord','camera','availability','mechanic','completes','style','insightKey','category','target','icon','lifeIcon','artKey','alphaBoundsKey','color','accentColor','presentation']);
const numeric:Record<string,[number,number]>={reflectMs:[0,2592000000],ms:[0,2592000000],count:[0,10000],quantity:[1,100],coins:[0,10000],coinCost:[0,10000],price:[0,10000],bond:[0,1000],required:[1,100],merges:[1,100],perBond:[1,100000],mergeXp:[0,10000],friendshipXp:[0,10000],energy:[0,10000],cell:[0,48]};
const artSlots:Record<CharacterId,Record<string,string>>={
  mossprout:{'old-grove':'shared_world_mossprout_old_grove_hex_tile_v1_512.webp'},
  steppling:{home:'shared_world_steppling_trailhead_hex_tile_v1_512.webp'},
  baristabbit:{home:'shared_world_baristabbit_window_hex_tile_v1_512.webp'},
  feastle:{home:'feastle_hearth_v1_hex_tile_512.webp'},
  petalimp:{'level-0':'mossprout_bloom_garden_level_0_hex_tile_512.webp','level-1':'mossprout_bloom_garden_level_1_hex_tile_512.webp','level-2':'mossprout_bloom_garden_level_2_hex_tile_512.webp','level-3':'mossprout_focused_v1_bloom_garden_hex_tile_512.webp','level-4':'mossprout_bloom_garden_level_4_hex_tile_512.webp'},
};
const serials=new Map<CharacterId,string>();
const descriptors=new Map<CharacterId,AuthorField[]>();
for(const character of CHARACTER_IDS){
  serials.set(character,JSON.stringify(sources[character],(_k,v)=>{if(typeof v==='function')throw new Error(`${character}: executable authoring source`);return v;}));
  descriptors.set(character, characterFields(sources[character]));
}
export function characterFields(source:RecordData){
  const fields:AuthorField[]=[];
  function visit(value:unknown,parts:string[]=[],copy=false){
    if(Array.isArray(value)){value.forEach((v,i)=>{
      if(typeof v==='string'&&copy){
        // Check-in tuples are [stable choice ID, display label].
        if(parts.at(-2)==='checkIn'&&i===0)return;
        fields.push({path:[...parts,String(i)].join('/'),label:parts.at(-2)==='checkIn'?'Choice label':parts.at(-1)!,value:v,max:4000});
      }
      else if(typeof v==='number'&&parts.at(-1)==='deliveryCells')fields.push({path:[...parts,String(i)].join('/'),label:'cell',value:v,min:0,max:48});
      else visit(v,[...parts,String(i)],copy);
    });return;}
    if(!isObject(value))return;
    if(parts.at(-1)==='daily' && !Object.hasOwn(value,'gardenActionLabel'))fields.push({path:[...parts,'gardenActionLabel'].join('/'),label:'gardenActionLabel (blank: Tend garden)',value:'',max:4000});
    for(const [key,v] of Object.entries(value)){
      const path=[...parts,key];
      if(protectedKeys.has(key)&&!(key==='target'&&typeof v==='number'&&parts.at(-1)==='feed'))continue;
      if(key.endsWith('DefinitionId')||key==='definitionId'){
        if(typeof v==='string')fields.push({path:path.join('/'),label:'Merge item',value:v,max:160,options:MERGE_ITEM_CATALOG.filter(i=>!i.progressionOnly).map(i=>({id:i.id,name:i.name}))});
      }else if(typeof v==='string'&&(textKeys.has(key)||copy)&&!/(Id|Key|Prefix|Capability)$/.test(key)) fields.push({path:path.join('/'),label:key,value:v,max:4000});
      else if(typeof v==='number'&&(numeric[key]||(key==='level'&&parts.includes('unlock'))||(key==='target'&&parts.at(-1)==='feed'))){
        const [min,max]=numeric[key]??(key==='target'?[1,100000]:[1,4]);fields.push({path:path.join('/'),label:key,value:v,min,max});
      }else visit(v,path,copy||copyContainers.has(key));
    }
  }
  visit(source);return fields;
}
function revision(id:CharacterId){const s=serials.get(id)!;let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return `${id}-${h.toString(16)}-${s.length}`;}
export function characterSource(id:CharacterId){
  if(!CHARACTER_IDS.includes(id))throw new Error('Unknown character');
  const source=JSON.parse(serials.get(id)!) as RecordData;
  const sections:Section[]=[];
  for(const [key,v]of Object.entries(source)){
    if(key==='chapter'&&isObject(v)){
      sections.push({path:'chapter',title:'Journey settings'});
      (v.episodes as RecordData[]).forEach((e,i)=>sections.push({path:`chapter/episodes/${i}`,title:`Journey ${i+1} · ${e.title}`}));
    }else if(key==='campaign'&&isObject(v)){
      (v.chapters as RecordData[]).forEach((e,i)=>sections.push({path:`campaign/chapters/${i}`,title:`Restoration ${i+1} · ${e.title}`}));
      sections.push({path:'campaign/copy',title:'Discovery and restoration copy'},{path:'campaign/payoff',title:'Final payoff'});
    }else if(key==='hatchable'&&isObject(v))for(const part of ['tile','mission','discoveryFlow','egg','dayOne','lesson','daily'])sections.push({path:`hatchable/${part}`,title:({tile:'Discovery tile',mission:'Mist mission',discoveryFlow:'Discovery guides',egg:'Egg and hatching',dayOne:'First day',lesson:'Merge tutorial',daily:'Daily interactions'} as Record<string,string>)[part]});
    else if(key!=='conversations')sections.push({path:key,title:key==='hatchProfile'?'Egg Wisp questions':key==='island'?'Island upgrade costs':key==='tile'?'Old Grove':'Daily interactions'});
  }
  return {character:id,source,sections,fields:descriptors.get(id)!,artSlots:artSlots[id],revision:revision(id),draft:{kind:'character-draft',version:1,character:id,sourceRevision:revision(id),name:`${id} edits`,edits:{},art:{}} as CharacterDraft};
}
export function validateCharacterDraft(input:unknown):{draft:CharacterDraft|null;issues:string[];model:RecordData|null}{
  const d=input as CharacterDraft,issues:string[]=[];
  if(!d||d.kind!=='character-draft'||d.version!==1||!CHARACTER_IDS.includes(d.character))return {draft:null,issues:['Invalid character draft'],model:null};
  if(d.sourceRevision!==revision(d.character))return {draft:null,issues:['Source changed. Keep this draft and reopen the current character before reapplying edits.'],model:null};
  if(typeof d.name!=='string'||!d.name.trim()||d.name.length>120)issues.push('Draft name must contain 1–120 characters');
  if(!isObject(d.edits)||!isObject(d.art))return {draft:null,issues:['Invalid edit or art map'],model:null};
  const allowed=new Map(descriptors.get(d.character)!.map(f=>[f.path,f]));
  const model=JSON.parse(serials.get(d.character)!) as RecordData;
  for(const [path,value] of Object.entries(d.edits)){
    const f=allowed.get(path);
    if(!f){issues.push(`${path}: IDs, structure and mechanics are protected`);continue;}
    if(typeof f.value==='number'? !Number.isSafeInteger(value)||Number(value)<f.min!||Number(value)>f.max : typeof value!=='string'||value.length>f.max|| (!path.endsWith('/gardenActionLabel')&&!!f.value.trim()&&!value.trim())){issues.push(`${path}: invalid ${typeof f.value==='number'?`number (${f.min}–${f.max})`:'text'}`);continue;}
    if(f.options&&!f.options.some(o=>o.id===value)){issues.push(`${path}: unknown merge item`);continue;}
    const parts=path.split('/');let cursor=model;for(const part of parts.slice(0,-1))cursor=cursor[part] as RecordData;cursor[parts.at(-1)!]=value;
  }
  for(const [slot,asset]of Object.entries(d.art))if(!Object.hasOwn(artSlots[d.character],slot)||typeof asset!=='string'||!/^[a-zA-Z0-9_-]+\.(webp|png|jpeg)$/.test(asset))issues.push(`${slot}: invalid art assignment`);
  for(const board of characterBoards(model)){
    const taken=new Set<number>();
    for(const cell of board.cells){if(!board.window.includes(cell.cell))issues.push(`${board.path}: cell ${cell.cell} is outside the active board`);if(taken.has(cell.cell))issues.push(`${board.path}: overlapping items at ${cell.cell}`);taken.add(cell.cell);}
    const deliveries=board.deliveryCells;
    if(new Set(deliveries).size!==deliveries.length||deliveries.some(c=>!board.window.includes(c)||taken.has(c)))issues.push(`${board.path}: delivery cells must be distinct empty active cells`);
  }
  return {draft:issues.length?null:JSON.parse(JSON.stringify(d)),issues,model:issues.length?null:model};
}
export function characterBoards(model:RecordData){
  const boards:{path:string;window:readonly number[];deliveryCells:number[];cells:{cell:number;definitionId:string;kind:string}[]}[]=[];
  function walk(value:unknown,path:string[]=[]){
    if(!value||typeof value!=='object')return;
    if(isObject(value)&&Array.isArray(value.items)&&Array.isArray(value.echoes)){
      const window=missionWindow(value.rows===3?3:4).cellIndices;
      boards.push({path:path.join('/'),window,deliveryCells:(value.deliveryCells??[]) as number[],cells:['items','echoes','veiled'].flatMap(kind=>(Array.isArray(value[kind])?value[kind] as {cell:number;definitionId:string}[]:[]).map(c=>({...c,kind})))});
    }
    for(const [key,v]of Object.entries(value))walk(v,[...path,key]);
  }walk(model);return boards;
}
export function characterDialogue(draft:CharacterDraft,index:number){
  const checked=validateCharacterDraft(draft);if(!checked.model)throw new Error(checked.issues.join('\n'));
  const chapter=checked.model.chapter as CompanionJourneyChapterDefinition|undefined;
  const episode=chapter?.episodes[index];if(!chapter||!episode)return null;
  if(episode.conversationId)return (checked.model.conversations as typeof companionConversationDefinitionsBundled)?.find(c=>c.id===episode.conversationId)??null;
  return journeyEpisodeConversation(chapter,episode)?.definition??null;
}
