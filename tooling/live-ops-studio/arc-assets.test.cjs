const test=require('node:test');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {measureImage}=require('./arc-assets.cjs');
test('measures visible alpha at threshold 16 with exclusive right/bottom edges',async()=>{
  const pixels=Buffer.alloc(1024*1024*4);
  for(const [x,y,a] of [[10,20,16],[300,400,255],[0,0,15]]) pixels[(y*1024+x)*4+3]=a;
  const image=await sharp(pixels,{raw:{width:1024,height:1024,channels:4}}).png().toBuffer();
  const result=await measureImage(image);
  assert.deepEqual(result.bounds,{left:10,top:20,right:301,bottom:401});
  assert.equal(result.bytes,image.length);assert.match(result.md5,/^[a-f0-9]{32}$/);
});
test('rejects transparent, corrupt and wrong-sized tiles',async()=>{
  for(const bytes of [Buffer.from('not an image'),await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).png().toBuffer(),await sharp({create:{width:512,height:512,channels:4,background:'#ffffff'}}).png().toBuffer()]) await assert.rejects(()=>measureImage(bytes));
});
