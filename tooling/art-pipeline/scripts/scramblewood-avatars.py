#!/usr/bin/env python3
"""Offline, resumable processing for reviewed Scramblewood character generations.
No network calls: prompts are executed with imagegen, then imported here.
"""
import argparse, hashlib, json, shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'art-source/egg-snap/scramblewood-v1'
RUNTIME = ROOT / 'apps/egg-snap/assets/characters'
STATES = ['neutral','half-blink','closed-blink','determined','attack','hurt','surprised','happy','defeated','talking']

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def spec(cid): return next(c for c in json.loads((SOURCE/'roster.json').read_text())['characters'] if c['id']==cid)
def read(path): return json.loads(path.read_text(encoding='utf-8'))
def write(path, obj): path.write_text(json.dumps(obj,indent=2),encoding='utf-8')
def matte(path):
    im=Image.open(path).convert('RGBA'); a=np.array(im).astype(float)
    # Magenta is reserved for the matte, including enclosed holes between features.
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    distance=np.maximum.reduce([255-r, g, 255-b])
    key=np.clip((110-distance)/65,0,1)
    a[:,:,3]*=1-key
    # Suppress residual pink edge contamination without erasing opaque feature colour.
    edge=(key>0)&(key<1)
    a[:,:,0][edge]=np.minimum(r[edge],g[edge]+35)
    a[:,:,2][edge]=np.minimum(b[edge],g[edge]+35)
    # Repair key-coloured enclosed mouth holes, preserving white eye interiors.
    opaque=Image.fromarray(np.where(a[:,:,3]>180,255,0).astype('uint8')).copy()
    ImageDraw.floodfill(opaque,(0,0),128)
    holes=np.array(opaque)==0
    a[holes]=[48,20,12,255]
    a[:,:,3][a[:,:,3]<12]=0
    return Image.fromarray(a.astype('uint8'))
def prepare(cid):
    folder=SOURCE/cid; config=read(folder/'registration.json')
    master=Image.open(folder/'master.png').convert('RGBA')
    if master.getextrema()[3][0]==255: raise ValueError('Master must have genuine alpha')
    edit=Image.open(folder/'body.png').convert('RGBA').resize(master.size)
    mask=Image.new('L',master.size); d=ImageDraw.Draw(mask)
    for box in config['eraseRegions']:
        d.rounded_rectangle(tuple(round(v*master.width) for v in box),radius=12,fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(master.width*.005))
    body=Image.composite(edit,master,mask);body.putalpha(master.getchannel('A'))
    out=folder/'prepared';out.mkdir(exist_ok=True)
    # One transform for body and registered face canvases; never crop per expression.
    def fit(im):
        canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(im.resize((430,430),Image.Resampling.LANCZOS),(41,41));return canvas
    fit(body).save(out/'body.png')
    facebox=config['faceBox'];x,y,w,h=[round(v*master.width) for v in facebox]
    for state in STATES:
        source=folder/'faces'/f'{state}.png'
        if not source.exists(): continue
        face=matte(source)
        canvas=Image.new('RGBA',master.size)
        if config.get('components'):
            for part in config['components']:
                crop=face.crop(tuple(round(v*face.width) for v in part['source']))
                px,py,pw,ph=[round(v*master.width) for v in part['target']]
                canvas.alpha_composite(crop.resize((pw,ph),Image.Resampling.LANCZOS),(px,py))
        else: canvas.alpha_composite(face.resize((w,h),Image.Resampling.LANCZOS),(x,y))
        fit(canvas).save(out/f'{state}.png')
    fit(master).resize((256,256),Image.Resampling.LANCZOS).save(out/'thumbnail.png')
    bounds=fit(body).getbbox(); l,t,r,b=bounds
    write(out/'geometry.json',{'anchor':{'x':.5,'y':b/512},'bounds':{'x':l/512,'y':t/512,'width':(r-l)/512,'height':(b-t)/512}})
def review(cid):
    folder=SOURCE/cid/'prepared';body=Image.open(folder/'body.png').convert('RGBA')
    board=Image.new('RGB',(1280,768),'#284345');draw=ImageDraw.Draw(board)
    for i,state in enumerate(['body']+STATES):
        im=body.copy()
        if state!='body' and (folder/f'{state}.png').exists():im.alpha_composite(Image.open(folder/f'{state}.png'))
        im.thumbnail((220,220));x=(i%5)*256;y=(i//5)*256
        board.paste(im,(x+18,y+16),im);draw.text((x+12,y+238),state,fill='white')
    board.save(SOURCE/cid/'review.jpg')
def validate(cid):
    folder=SOURCE/cid/'prepared'
    for name in ['body']+STATES:
        path=folder/f'{name}.png'
        if not path.exists():raise ValueError(f'Missing {cid}/{name}')
        im=Image.open(path)
        if im.size!=(512,512) or im.mode!='RGBA' or not im.getbbox() or im.getextrema()[3][0]!=0:raise ValueError(f'Invalid alpha/canvas: {path}')
    return {p.name:digest(p) for p in sorted(folder.glob('*.png'))}
def promote(cid):
    hashes=validate(cid);folder=SOURCE/cid
    approval=read(folder/'approval.json')
    if approval.get('hashes')!=hashes:raise ValueError('Review approval is missing or stale')
    target=RUNTIME/cid;target.mkdir(parents=True,exist_ok=True)
    for p in (folder/'prepared').glob('*.png'):shutil.copy2(p,target/p.name)
    shutil.copy2(folder/'prepared/geometry.json',target/'geometry.json')
    catalog={}
    for c in read(SOURCE/'roster.json')['characters']:
        if (RUNTIME/c['id']/'body.png').exists():catalog[c['id']]=read(RUNTIME/c['id']/'geometry.json')
    write(ROOT/'apps/egg-snap/data/character-geometry.gen.json',catalog)
    lines=["// Generated by scramblewood-avatars.py; reviewed runtime assets only.","import type { ImageSource } from 'expo-image';", "export type CharacterArt = {body: ImageSource; thumbnail: ImageSource; faces: Record<string, ImageSource>};", "export const CHARACTER_ART: Record<string, CharacterArt> = {"]
    for cid in catalog:
        lines.append(f"  '{cid}': {{body: require('../assets/characters/{cid}/body.png'), thumbnail: require('../assets/characters/{cid}/thumbnail.png'), faces: {{")
        for state in STATES:lines.append(f"    '{state}': require('../assets/characters/{cid}/{state}.png'),")
        lines.append('  }},')
    lines.append('};');(ROOT/'apps/egg-snap/data/character-art.gen.ts').write_text('\n'.join(lines)+'\n',encoding='utf-8')
def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['prepare','review','validate','approve','promote','import']);p.add_argument('character');p.add_argument('--source',type=Path);p.add_argument('--slot');p.add_argument('--reviewer');args=p.parse_args();folder=SOURCE/args.character;spec(args.character)
    if args.command=='import':
        if not args.source or not args.slot: p.error('import needs --source and --slot')
        if args.slot not in ['master','body']+STATES:p.error('Unknown slot')
        dest=folder/(f'faces/{args.slot}.png' if args.slot in STATES else f'{args.slot}.png');dest.parent.mkdir(exist_ok=True);shutil.copy2(args.source,dest)
        record=read(folder/'provenance.json') if (folder/'provenance.json').exists() else {}
        record[args.slot]={'sha256':digest(dest),'source':str(args.source),'generator':'imagegen','style':'scramblewood-toy-v1'};write(folder/'provenance.json',record)
    elif args.command=='approve':
        if not args.reviewer:p.error('Name the visual reviewer')
        write(folder/'approval.json',{'reviewer':args.reviewer,'hashes':validate(args.character)})
    else:globals()[args.command](args.character)
if __name__=='__main__':main()
