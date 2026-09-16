const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {zipSync,strToU8}=require('fflate');
module.exports=function(app,{moduleAt,wrap,drafts,assets,assetFile}){
  const api=()=>moduleAt('features/content-authoring/character-editor.ts');
  const directory=path.join(drafts,'characters');
  async function check(input){const result=api().validateCharacterDraft(input);if(result.draft)for(const id of Object.values(result.draft.art))try{await assetFile(id);}catch{result.issues.push(`Missing image: ${id}`);}if(result.issues.length){result.draft=null;result.model=null;}return result;}
  app.get('/api/characters/:id/source',wrap(async(req,res)=>res.json({...api().characterSource(req.params.id),assets:await assets()})));
  app.post('/api/characters/validate',wrap(async(req,res)=>{
    const result=await check(req.body);res.json({...result,boards:result.model?api().characterBoards(result.model):[]});
  }));
  app.post('/api/characters/dialogue',wrap(async(req,res)=>{
    const checked=await check(req.body.draft);if(!checked.draft)return res.status(400).json({issues:checked.issues});
    res.json({conversation:api().characterDialogue(checked.draft,req.body.index)});
  }));
  app.get('/api/characters/:id/drafts',wrap(async(req,res)=>{
    if(!api().CHARACTER_IDS.includes(req.params.id))throw new Error('Unknown character');
    await fs.mkdir(directory,{recursive:true});res.json({drafts:(await fs.readdir(directory)).filter(f=>f.startsWith(`${req.params.id}-`)&&f.endsWith('.json')).sort().reverse()});
  }));
  app.get('/api/characters/drafts/:file',wrap(async(req,res)=>{
    if(!/^(mossprout|steppling|petalimp|baristabbit|feastle)-[0-9]+-[a-f0-9-]+\.json$/.test(req.params.file))throw new Error('Invalid draft filename');
    res.json(JSON.parse(await fs.readFile(path.join(directory,req.params.file),'utf8')));
  }));
  app.post('/api/characters/drafts',wrap(async(req,res)=>{
    const d=req.body;if(d?.kind!=='character-draft'||d.version!==1||!api().CHARACTER_IDS.includes(d.character)||typeof d.name!=='string'||typeof d.sourceRevision!=='string'||!d.edits||typeof d.edits!=='object'||Array.isArray(d.edits)||!d.art||typeof d.art!=='object'||Array.isArray(d.art))throw new Error('Invalid draft');
    await fs.mkdir(directory,{recursive:true});const file=`${d.character}-${Date.now()}-${randomUUID()}.json`;
    await fs.writeFile(path.join(directory,file),JSON.stringify(d,null,2),{flag:'wx'});res.json({saved:file});
  }));
  app.post('/api/characters/review',wrap(async(req,res)=>{
    const checked=await check(req.body);if(!checked.draft)return res.status(400).json({issues:checked.issues});
    const catalog=api().characterSource(checked.draft.character);
    const changes=Object.entries(checked.draft.edits).map(([path,after])=>({path,before:catalog.fields.find(f=>f.path===path)?.value,after}));
    const files={'draft.json':strToU8(JSON.stringify(checked.draft,null,2)),'content.json':strToU8(JSON.stringify(checked.model,null,2)),'changes.json':strToU8(JSON.stringify(changes,null,2))};
    for(const id of new Set(Object.values(checked.draft.art)))files[`art/${id}`]=await fs.readFile(await assetFile(id));
    files['README.txt']=strToU8(`Character review bundle: ${checked.draft.character}\nSource: ${checked.draft.sourceRevision}\nThis is NOT an installable content pack. It edits existing bundled IDs. Review changes.json and integrate content.json into the corresponding constants (Journey chapter, hatchable definition or island campaign) and art assignments from draft.json. Rebuild and playtest the game. IDs and existing array structure are preserved. Structural board checks do not prove puzzle solvability or economy balance. Art here is for review, without production bounds/hosting. No player save or shipped content was changed by export.`);
    res.type('application/zip').send(Buffer.from(zipSync(files,{level:0})));
  }));
};
