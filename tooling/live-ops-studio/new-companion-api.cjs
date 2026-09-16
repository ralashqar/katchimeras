const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const sharp=require('sharp');
const {zipSync,strToU8}=require('fflate');
const {measureImage}=require('./arc-assets.cjs');
module.exports=function(app,{moduleAt,wrap,drafts}){
  const api=()=>moduleAt('features/content-authoring/new-companion.ts');
  const directory=path.join(drafts,'new-companions'),images=path.join(directory,'assets');
  const file=id=>{if(typeof id!=='string'||!/^[a-f0-9]{64}\.webp$/.test(id))throw new Error('Invalid image ID');return path.join(images,id);};
  async function store(bytes){
    if(bytes.length>1800000)throw new Error('Images must be under 1.8 MB');
    const input=sharp(bytes,{limitInputPixels:4096*4096,animated:false});const m=await input.metadata();
    if(!['png','webp','jpeg'].includes(m.format)||(m.pages??1)!==1)throw new Error('Use a still PNG, WebP or JPEG');
    const converted=await input.resize(1024,1024,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).webp({quality:90}).toBuffer();
    const measured=await measureImage(converted),id=createHash('sha256').update(converted).digest('hex')+'.webp';
    await fs.mkdir(images,{recursive:true});await fs.writeFile(file(id),converted);return {id,url:`/api/new-companions/assets/${id}`,...measured};
  }
  async function prepare(draft){
    if(!draft?.art||typeof draft.art!=='object')throw new Error('Assign tile and character art');
    let base;try{base=new URL(draft.assetBaseUrl);if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw Error();}catch{throw new Error('Enter an HTTPS asset hosting folder without credentials, query or fragment');}
    const art={},files={};
    for(const slot of ['tile','cutout']){
      const id=draft.art[slot],bytes=await fs.readFile(file(id)),measured=await measureImage(bytes);
      if(createHash('sha256').update(bytes).digest('hex')+'.webp'!==id)throw new Error('Image changed. Upload it again.');
      art[slot==='tile'?`tile:${draft.character}-home:full`:`cutout:${draft.character}`]={url:base.href.replace(/\/$/,'')+'/'+id,bytes:measured.bytes,md5:measured.md5,...(slot==='tile'?{alphaBounds:measured.bounds}:{})};
      files['assets/'+id]=bytes;
    }
    return {...api().compileNewCompanion(draft,art),files};
  }
  app.get('/api/new-companions/catalog',wrap(async(_req,res)=>res.json(api().newCompanionCatalog())));
  app.get('/api/new-companions/source/:character',wrap(async(req,res)=>res.json(api().newCompanionSource(req.params.character))));
  app.post('/api/new-companions/feastle-art',wrap(async(_req,res)=>res.json({tile:await store(await fs.readFile(require.resolve('@incubator/art-world/hex/floating_feastle_hex_tile_v1.webp'))),cutout:await store(await fs.readFile(require.resolve('@incubator/art-cutouts/feastle.png')))})));
  app.post('/api/new-companions/assets',wrap(async(req,res)=>{const m=req.body?.data?.match(/^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw new Error('Choose an image');res.json(await store(Buffer.from(m[2],'base64')));}));
  app.get('/api/new-companions/assets/:id',wrap(async(req,res)=>res.sendFile(file(req.params.id))));
  app.post('/api/new-companions/validate',wrap(async(req,res)=>{const {pack,issues}=await prepare(req.body);res.json({pack,issues});}));
  app.post('/api/new-companions/drafts',wrap(async(req,res)=>{
    if(req.body?.kind!=='new-companion'||!api().newCompanionCatalog().characters.some(c=>c.id===req.body.character))throw new Error('Invalid draft');
    await fs.mkdir(directory,{recursive:true});const name=`companion-${Date.now()}-${randomUUID()}.json`;await fs.writeFile(path.join(directory,name),JSON.stringify(req.body,null,2),{flag:'wx'});res.json({saved:name});
  }));
  app.get('/api/new-companions/drafts',wrap(async(_req,res)=>{await fs.mkdir(directory,{recursive:true});res.json({drafts:(await fs.readdir(directory)).filter(f=>/^companion-[0-9]+-[a-f0-9-]+\.json$/.test(f)).sort().reverse()});}));
  app.get('/api/new-companions/drafts/:file',wrap(async(req,res)=>{if(!/^companion-[0-9]+-[a-f0-9-]+\.json$/.test(req.params.file))throw new Error('Invalid draft');res.json(JSON.parse(await fs.readFile(path.join(directory,req.params.file),'utf8')));}));
  app.post('/api/new-companions/bundle',wrap(async(req,res)=>{
    const result=await prepare(req.body);if(!result.pack)return res.status(400).json({issues:result.issues});
    const files={...result.files,'manifest.json':strToU8(JSON.stringify(result.pack,null,2)),'draft.json':strToU8(JSON.stringify(req.body,null,2)),
      'README.txt':strToU8('Upload assets/ to the HTTPS folder in draft.json, retaining filenames. Import manifest.json using Developer Tools > Content Packs on a test profile, then restart the game. The pack adds a hatchable and Journey for an existing roster character; its existing family, skins and animations are reused. The assigned cutout is used by the merge-lesson scene. Check rescue gating, board completion, Egg answers, hatch, first-day parcel, lesson, Journey and daily moment. Downloaded content works offline after installation. Do not remove a pack from real player saves. This export neither hosts assets nor publishes content. Validate alongside other releases before promotion.')};
    res.type('application/zip').send(Buffer.from(zipSync(files,{level:0})));
  }));
};
