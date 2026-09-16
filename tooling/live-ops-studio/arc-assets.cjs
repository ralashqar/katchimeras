const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { zipSync, strToU8 } = require('fflate');

async function measureImage(bytes) {
  if (!bytes.length || bytes.length > 1800000) throw new Error('Use an image smaller than 1.8 MB');
  const decoder = sharp(bytes, { limitInputPixels: 1024 * 1024, animated: false });
  const meta = await decoder.metadata();
  if (!['png', 'webp', 'jpeg'].includes(meta.format) || meta.width !== 1024 || meta.height !== 1024 || (meta.pages ?? 1) !== 1) throw new Error('Tile art must be a single 1024 × 1024 PNG, WebP or JPEG');
  const { data, info } = await decoder.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left=1024, top=1024, right=0, bottom=0;
  for (let y=0;y<info.height;y++) for (let x=0;x<info.width;x++) {
    if (data[(y*info.width+x)*info.channels+info.channels-1] < 16) continue;
    left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
  }
  if (right <= left || bottom <= top) throw new Error('Tile image has no visible pixels');
  return { bounds:{left,top,right,bottom}, format:meta.format, bytes:bytes.length, md5:createHash('md5').update(bytes).digest('hex') };
}

module.exports = function installArcAssets(app, { drafts, wrap, compile }) {
  const directory=path.join(drafts,'arcs','assets');
  const assetPath=id=>{
    if (typeof id !== 'string' || !/^[a-f0-9]{64}\.(png|webp|jpeg)$/.test(id)) throw new Error('Invalid local tile asset');
    return path.join(directory,id);
  };
  async function prepare(input) {
    const draft=structuredClone(input);
    const files={}; const metadata={};
    if (!Array.isArray(draft?.tiles)) throw new Error('Invalid arc draft');
    for (const tile of draft.tiles) {
      if (!tile?.localAsset) continue;
      let base;
      try { base=new URL(draft.assetBaseUrl); if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash) throw new Error(); } catch { throw new Error('Set an HTTPS asset hosting folder without credentials, query or fragment before exporting local images'); }
      const bytes=await fs.readFile(assetPath(tile.localAsset));
      const measured=await measureImage(bytes);
      const expected=createHash('sha256').update(bytes).digest('hex')+'.'+measured.format;
      if (expected!==tile.localAsset) throw new Error('Local asset changed; upload it again');
      tile.imageUrl=base.href.replace(/\/$/,'')+'/'+tile.localAsset;
      tile.bounds=measured.bounds;
      files[`assets/${tile.localAsset}`]=bytes;
      metadata[`tile:${draft.id}:tile-${tile.id}:full`]={bytes:measured.bytes,md5:measured.md5};
    }
    const result=compile(draft);
    if(result.pack) for(const [key,meta] of Object.entries(metadata)) Object.assign(result.pack.art[key],meta);
    return {...result,files};
  }
  app.post('/api/arcs/assets',wrap(async(req,res)=>{
    const match=typeof req.body?.data==='string'&&req.body.data.match(/^data:image\/(png|webp|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if(!match) throw new Error('Choose a PNG, WebP or JPEG image');
    const bytes=Buffer.from(match[2],'base64'); const measured=await measureImage(bytes);
    if(measured.format!==match[1]) throw new Error('Image format does not match its bytes');
    const id=createHash('sha256').update(bytes).digest('hex')+'.'+measured.format;
    await fs.mkdir(directory,{recursive:true});
    try { await fs.writeFile(assetPath(id),bytes,{flag:'wx'}); } catch(e) {if(e.code!=='EEXIST')throw e;}
    res.json({id,url:`/api/arcs/assets/${id}`,...measured});
  }));
  app.get('/api/arcs/assets/:id',wrap(async(req,res)=>res.sendFile(assetPath(req.params.id))));
  app.post('/api/arcs/bundle',wrap(async(req,res)=>{
    const result=await prepare(req.body);
    if(!result.pack) return res.status(400).json({issues:result.issues});
    const external=Object.keys(result.pack.art??{}).filter(key=>!result.pack.art[key].md5);
    const files={...result.files,'manifest.json':strToU8(JSON.stringify(result.pack,null,2)), 'draft.json':strToU8(JSON.stringify(req.body,null,2)),
      'README.txt':strToU8(`Upload the contents of assets/ to the asset hosting folder specified in draft.json. Keep filenames unchanged. Manifest URLs are deployment destinations, not proof of upload. External art references (not bundled): ${external.join(', ') || 'none'}. Validate the combined release and test in the app before promotion. This archive does not publish content.`)};
    res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="${result.pack.id}-${result.pack.version}.zip"`);
    res.send(Buffer.from(zipSync(files,{level:0})));
  }));
  return {prepare};
};
module.exports.measureImage=measureImage;
