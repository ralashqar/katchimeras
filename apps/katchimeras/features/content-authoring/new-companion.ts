import { HATCH_PROFILES } from '@/features/onboarding/hatch-profile';
import { BARISTABBIT_HATCHABLE } from '@/constants/hatchable-companions/baristabbit';
import { HATCHABLE_COMPANIONS_BUNDLED } from '@/constants/hatchable-companions/registry';
import { KATCHIMERA_MERGE_PROFILES, MERGE_CHARACTER_NAMES, MERGE_GENERATORS, MERGE_ITEMS_BY_ID } from '@/constants/merge-world-catalog';
import { characterFields, characterBoards } from './character-editor';
import { arcCatalog } from './arc-builder';
import { normalizeContentRelease } from '@/features/content-packs/normalize-release';
import type { HatchableCompanionDefinition } from '@/types/hatchable-companion';
import type { ContentPack } from '@/types/content-pack';

export type NewCompanionDraft = {
  kind:'new-companion'; version:1; templateVersion:1; sourceRevision:string; character:string; id:string;
  releaseVersion:number; q:number; r:number; price:number; after:string;
  edits:Record<string,string|number>; assetBaseUrl:string;
  art:{tile:string;cutout:string};
  episodes:{id:string;title:string;text:string;hours:number}[];
};
const get=(o:any,path:string)=>path.split('/').reduce((v,k)=>v?.[k],o);
function templateRevision(character:string){const text=JSON.stringify(companionTemplate(character));let hash=2166136261;for(const c of text)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;return `${hash.toString(16)}-${text.length}`;}
export function newCompanionCatalog(){
  return {characters:Object.keys(KATCHIMERA_MERGE_PROFILES).filter(id=>HATCH_PROFILES[id]&&id!=='mossprout'&&id!=='petalimp'&&!HATCHABLE_COMPANIONS_BUNDLED.some(h=>h.companion===id)).filter(id=>MERGE_GENERATORS.some(g=>g.chainIds.includes(KATCHIMERA_MERGE_PROFILES[id].coreChains[0]))).map(id=>({id,name:MERGE_CHARACTER_NAMES[id]})),
    predecessors:['mossprout',...HATCHABLE_COMPANIONS_BUNDLED.map(h=>h.companion)],occupied:arcCatalog().occupied};
}
export function newCompanionDraft(character=newCompanionCatalog().characters[0]?.id ?? ''):NewCompanionDraft{
  if(!newCompanionCatalog().characters.some(c=>c.id===character))throw new Error('Choose an available roster character');
  const occupied=new Set(arcCatalog().occupied.map(t=>`${t.q},${t.r}`));
  let q=0,r=-2;while(occupied.has(`${q},${r}`))q++;
  return {kind:'new-companion',version:1,templateVersion:1,sourceRevision:templateRevision(character),character,id:`${character}-arrival`,releaseVersion:1,q,r,price:60,after:'mossprout',edits:{},assetBaseUrl:'',art:{tile:'',cutout:''},episodes:[{id:'a-place-together',title:character==='feastle'?'A place at the table':'A place together',text:character==='feastle'?'The table is small. There is room for you. Tomorrow we can make room for someone else.':'The Mist kept this place quiet. Now there is someone to share it with.',hours:0}]};
}
/** A fixed, versioned recipe. IDs are generated, never copied from another friend's save. */
export function companionTemplate(character:string):HatchableCompanionDefinition{
  if(!newCompanionCatalog().characters.some(c=>c.id===character))throw new Error('Choose an available roster character');
  const name=MERGE_CHARACTER_NAMES[character];
  const chain=KATCHIMERA_MERGE_PROFILES[character].coreChains[0];
  const generator=MERGE_GENERATORS.find(g=>g.chainIds.includes(chain))!;
  const drop=`${chain}:1`,grow=`${chain}:2`,dropName=MERGE_ITEMS_BY_ID.get(drop)!.name,growName=MERGE_ITEMS_BY_ID.get(grow)!.name;
  const h=JSON.parse(JSON.stringify(BARISTABBIT_HATCHABLE).replaceAll('baristabbit',character).replaceAll('Baristabbit',name)) as HatchableCompanionDefinition;
  // Baristabbit's own rescue battle (FTUE v2) is his, not the template's: a new friend starts on the authored board and a
  // ticket, until their own rescue battle is authored.
  delete h.mission.encounter;delete h.mission.rescue;
  h.tile={...h.tile,price:60,name:character==='feastle'?'A table in the Mist':'A shelter in the Mist',unlockId:`${character}:arrival`,alphaBoundsKey:`tile:${h.tile.id}`,markerLines:{sleeping:'There is someone beyond the Mist.'}};
  h.discovery={gateId:'gate-3-first-choice',pathId:`${character}-arrival`};
  h.availability={kind:'after_companion',companion:'mossprout'};
  h.mission.seed=JSON.parse(JSON.stringify(h.mission.seed).replaceAll('drink:refresh',chain));
  h.mission.guides={firstMerge:{eyebrow:'Left behind',title:`Two ${dropName}. Together.`,body:'Every merge strikes a wisp.'},wake:{eyebrow:'Under the Mist',title:'Something needs {a} {name}.',body:'Give it its match to wake it.'},merge:{eyebrow:'Two of a kind',title:'Make {a} {name}.',body:'Drag matching items together.'},mergeFallbackTitle:'Two of the same make the next one up.',free:{eyebrow:'Keep going',title:'Push back the Mist.',body:'Every merge brings our friend closer.'}};
  h.mission.lines={firstStrike:'Something stirs beyond the Mist.',fell:['A little more light.','The path is opening.','One wisp remains.'],last:'The last wisp falls. Someone was waiting here.',reveal:'There is more beneath it.'};
  h.discoveryFlow={...h.discoveryFlow,version:1,migrations:undefined,egg:{guide:{eyebrow:'An Egg',title:'Someone is waiting inside.',body:'Let them know they are not alone.'},actionLabel:'Meet the Egg'}};
  h.egg={...h.egg,intent:{...h.egg.intent,title:'What shall we make room for?',options:[{id:'quiet',label:'A quiet moment'},{id:'share',label:'Something to share'},{id:'begin',label:'A new beginning'}]},alternative:{...h.egg.alternative,title:'What can we bring to this little home?',options:[{id:'care',label:'Some care'},{id:'time',label:'A little time'},{id:'company',label:'Good company'},{id:'hope',label:'Hope'}]},guides:Object.fromEntries(['intent','reading','feed','permission','alternative','ready'].map(k=>[k,{eyebrow:k==='ready'?'Awake':'A new friend',title:k==='ready'?'Your friend is ready to meet you.':'Tell the Egg a little about yourself.',body:''}])) as HatchableCompanionDefinition['egg']['guides']};
  h.dayOne={...h.dayOne,flow:{...h.dayOne.flow,title:'A place together'},opening:character==='feastle'?'I kept a place at the table. The Mist could hide the chairs, but not the smell of something warm. What shall we make room for?':'I wondered who would find this place. Now you are here. What shall we make room for?',choices:[{id:'quiet',label:'A quiet moment'},{id:'share',label:'Something to share'},{id:'begin',label:'A new beginning'}],handoffs:{quiet:'There is no hurry here. I brought something for our Garden.',share:'A little becomes more when we share it. I brought something for our Garden.',begin:'Then this can be our first small beginning. I brought something for our Garden.'},endMessage:'A parcel is waiting in our Garden.',choiceVariable:'welcomeChoice',parcel:{...h.dayOne.parcel,generatorId:generator.id}};
  h.economy={generatorId:generator.id};
  h.lesson={...h.lesson,generatorId:generator.id,dropDefinitionId:drop,growDefinitionId:grow,closing:'A little less Mist. A little more room for us.',summary:'A home begins with small things',order:{...h.lesson.order,title:`${name}'s first ${growName}`,description:`Make a ${growName} for ${name}.`,requirements:[{definitionId:grow,quantity:1}]},copy:{parcel:{eyebrow:'A gift',title:`A parcel from ${name}.`,body:'Tap to open it.'},room:{eyebrow:'A little room',title:'Make a space.',body:'Merge or store an item to continue.'},grow:{eyebrow:'Two of a kind',title:`Make a ${growName}.`,body:`Merge two ${dropName} from the ${generator.name}.`},serve:{eyebrow:'For our friend',title:`Serve the ${growName}.`,body:'A small gift makes a difference.'},finale:{eyebrow:'Together',title:`Back to ${name}.`,body:''},finaleAction:'Our new beginning'}};
  h.daily={chapterTitle:'A place together',restingLine:`${name} is resting. The Garden is open.`,idleLine:'There is room for a little moment together.',questionSubtitle:'A small moment from today.',presentation:'rows',polls:[],moment:{title:'Our daily moment',prompt:'What did today make room for?',artKey:'today:photo',options:[{id:'quiet',label:'Some quiet'},{id:'company',label:'Good company'}],replies:{quiet:'A quiet moment counts too.',company:'There is room for them here.'},thanks:'Thank you for sharing today with me.'}};
  return h;
}
export function newCompanionSource(character:string){const hatchable=companionTemplate(character);return {hatchable,fields:characterFields({hatchable}),draft:newCompanionDraft(character)};}
export function compileNewCompanion(input:unknown,art:NonNullable<ContentPack['art']>={}) : {pack:ContentPack|null;issues:string[]}{
  const d=input as NewCompanionDraft,issues:string[]=[];
  if(!d||d.kind!=='new-companion'||d.version!==1||d.templateVersion!==1||!newCompanionCatalog().characters.some(c=>c.id===d.character))return {pack:null,issues:['Unsupported companion template or character']};
  if(d.sourceRevision!==templateRevision(d.character))return {pack:null,issues:['Template source changed. Save this draft and recreate from the current template before reapplying edits.']};
  const integer=(n:unknown,min:number,max:number)=>Number.isSafeInteger(n)&&Number(n)>=min&&Number(n)<=max;
  if(typeof d.id!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(d.id)||!integer(d.releaseVersion,1,100000))issues.push('Enter a release slug and positive version');
  if(!integer(d.q,-30,30)||!integer(d.r,-30,30)||arcCatalog().occupied.some(t=>t.q===d.q&&t.r===d.r))issues.push('Choose an unoccupied hex with coordinates from -30 to 30');
  if(!integer(d.price,0,10000)||!newCompanionCatalog().predecessors.includes(d.after))issues.push('Choose a valid rescue cost and predecessor');
  if(!d.edits||typeof d.edits!=='object'||Array.isArray(d.edits)||!Array.isArray(d.episodes)||d.episodes.length<1||d.episodes.length>50)return {pack:null,issues:[...issues,'Invalid edits or Journey episodes']};
  const {hatchable,fields}=newCompanionSource(d.character),model={hatchable};
  for(const [path,value]of Object.entries(d.edits)){
    const f=fields.find(f=>f.path===path);
    if(!f|| (typeof f.value==='number'?!integer(value,f.min!,f.max):typeof value!=='string'||value.length>f.max||(!!f.value.trim()&&!value.trim())) ||(f?.options&&!f.options.some(o=>o.id===value))){issues.push(`${path}: invalid or protected field`);continue;}
    const parts=path.split('/');const parent=get(model,parts.slice(0,-1).join('/'));parent[parts.at(-1)!]=value;
  }
  for(const b of characterBoards(model)){const cells=b.cells.map(c=>c.cell);if(new Set(cells).size!==cells.length||cells.some(c=>!b.window.includes(c)))issues.push(`${b.path}: overlapping or inactive board cells`);}
  const lesson=hatchable.lesson,drop=MERGE_ITEMS_BY_ID.get(lesson.dropDefinitionId),generator=MERGE_GENERATORS.find(g=>g.id===lesson.generatorId);
  if(!drop||drop.tier!==1||drop.nextItemId!==lesson.growDefinitionId||!generator?.chainIds.includes(drop.chainId)||lesson.order.requirements.some(r=>r.definitionId!==lesson.growDefinitionId||r.quantity!==1))issues.push('The introductory lesson must grow and serve one tier-two item from its generator’s tier-one drops');
  const ids=new Set<string>();for(const e of d.episodes){if(!e||typeof e.id!=='string'||!/^[a-z][a-z0-9-]{0,59}$/.test(e.id)||ids.has(e.id)||!['title','text'].every(k=>typeof e[k as 'title']==='string'&&e[k as 'title'].trim()&&e[k as 'title'].length<=4000)||typeof e.hours!=='number'||!Number.isFinite(e.hours)||e.hours<0||e.hours>720||!Number.isSafeInteger(e.hours*3600000))issues.push('Journey episodes need unique slugs, copy and waits from 0–720 hours');ids.add(e?.id);}
  if(issues.length)return {pack:null,issues};
  hatchable.tile.coord={q:d.q,r:d.r};hatchable.tile.price=d.price;hatchable.availability={kind:'after_companion',companion:d.after};
  const pack:ContentPack={id:d.id,version:d.releaseVersion,contentSchemaVersion:2,title:`${hatchable.displayName}: A new beginning`,hatchables:[hatchable],art,chapters:[{
    familyId:d.character,chapterId:`${d.id}:chapter`,title:'A place together',purpose:'Push back the Mist and build a home together.',dayOne:{flowId:hatchable.dayOne.flow.id,runId:hatchable.dayOne.flow.runId},generatorId:hatchable.economy.generatorId,evidence:'none',reflectMs:0,
    lines:{foreshadow:'There is more to discover together.',complete:'Our first memories belong here.',checkIn:[['rest','I took a quiet moment']],lifeIcon:'heart.fill'},
    episodes:[{id:'day-1',title:hatchable.dayOne.flow.title,dayOne:true,flavour:'companion',unlock:[{kind:'day_one_complete'}]},...d.episodes.map((e,i)=>({id:e.id,title:e.title,flavour:'relationship' as const,reflectMs:0,unlock:[{kind:'episode_complete' as const,episodeId:i?d.episodes[i-1].id:'day-1'},...(e.hours?[{kind:'since_previous' as const,ms:e.hours*3600000}]:[])],beats:[{kind:'end' as const,text:e.text}]}))]
  }]};
  if(ids.has('day-1'))return {pack:null,issues:['day-1 is reserved for the hatch conversation']};
  const checked=normalizeContentRelease([pack]);return {pack:checked.packs[0]??null,issues:checked.issues};
}
