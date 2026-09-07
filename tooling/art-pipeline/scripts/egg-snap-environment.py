"""Prepare built-in imagegen briefs, review candidates and publish geometry-locked duel art.

No provider request is made by this CLI. Generate from the prepared brief using
the built-in image tool, then import and visually review before activation.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import re
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / 'apps/egg-snap/data'
ART = ROOT / 'art/assets/images/katchimeras/world/backgrounds/duel-stages'
TEMPLATE = APP / 'combat-stage-template.json'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def save(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'import', 'activate'])
    parser.add_argument('id')
    parser.add_argument('--style')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--review-note')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.id):
        parser.error('Use a lowercase hyphen-separated asset id')
    template = json.loads(TEMPLATE.read_text())
    reference = ROOT / template['reference']
    work = ART / 'recipes' / args.id
    recipe_path = work / 'recipe.json'
    if args.action == 'prepare':
        if not args.style or recipe_path.exists():
            parser.error('Supply --style and an unused id')
        work.mkdir(parents=True)
        prompt = f'''Restyle the supplied approved combat background. This is a strict geometry-preserving edit.
STYLE: {args.style}
Keep the exact portrait aspect ratio, camera elevation, perspective, horizon and both platform silhouettes, positions and scales. Do not zoom, crop, move, enlarge or deepen platforms. Repaint their materials only. Preserve empty standing surfaces and the calm gameplay corridor. Change surrounding scenery and materials to the requested style, keeping it out of the target areas. No eggs, characters, character shadows, UI, lettering, symbols or puzzle pieces.
Normalized standing contacts: player {template['player']['contact']}; rival {template['rival']['contact']}. The reference image is authoritative for complete silhouettes, including side walls and rims; the guide rectangles mark standing surfaces, not cutout masks. Keep readable large shapes and avoid high-frequency detail.
'''
        (work / 'prompt.txt').write_text(prompt, encoding='utf-8')
        shutil.copyfile(reference, work / 'reference.png')
        save(recipe_path, {'id': args.id, 'provider': 'built-in imagegen', 'style': args.style,
            'templateSha256': digest(TEMPLATE), 'referenceSha256': digest(reference), 'status': 'prepared'})
    if not recipe_path.exists():
        parser.error('Prepare this id first')
    recipe = json.loads(recipe_path.read_text())
    if recipe['templateSha256'] != digest(TEMPLATE) or recipe['referenceSha256'] != digest(reference):
        parser.error('Canonical geometry/reference changed; prepare a new recipe')
    if args.action == 'import':
        if not args.source or (work / 'candidate.png').exists():
            parser.error('Supply --source for an unused candidate recipe')
        with Image.open(args.source) as im:
            w, h = template['sourceSize'].values()
            if abs((im.width / im.height) / (w / h) - 1) > .005:
                parser.error('Aspect ratio changed by more than 0.5%; regenerate without cropping')
            im.convert('RGB').resize((w, h), Image.Resampling.LANCZOS).save(work / 'candidate.png')
        recipe.update(status='awaiting-visual-review', candidateSha256=digest(work / 'candidate.png'))
        save(recipe_path, recipe)
    # Same guides overlay the reference and candidate for visual silhouette/contact review.
    w, h = template['sourceSize'].values()
    marks = ''
    for key, colour in [('player', '#00ffff'), ('rival', '#ffcc44')]:
        p, c = template[key]['platform'], template[key]['contact']
        marks += f'<rect x="{p["x"]*w}" y="{p["y"]*h}" width="{p["width"]*w}" height="{p["height"]*h}" fill="none" stroke="{colour}" stroke-width="3"/><circle cx="{c["x"]*w}" cy="{c["y"]*h}" r="7" fill="{colour}"/>'
    (work / 'guide.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{marks}</svg>', encoding='utf-8')
    (work / 'review.html').write_text(f'''<!doctype html><title>{html.escape(args.id)} review</title>
<style>body{{background:#17251c;color:white;font-family:sans-serif}}main{{display:flex;gap:16px}}figure{{position:relative;margin:0;width:45vw}}img{{width:100%}}.guide{{position:absolute;inset:0}}</style>
<p>Compare camera, complete platform rims and contact points. Reject moved/scaled platforms; do not adjust gameplay geometry to rescue a candidate.</p><main><figure><img src="reference.png"><img class="guide" src="guide.svg"></figure><figure><img src="candidate.png"><img class="guide" src="guide.svg"></figure></main>''', encoding='utf-8')
    if args.action == 'activate':
        candidate = work / 'candidate.png'
        if not args.review_note or not candidate.exists() or digest(candidate) != recipe.get('candidateSha256'):
            parser.error('Import candidate, inspect review.html and supply --review-note')
        shutil.copyfile(candidate, ART / 'source' / f'{args.id}.png')
        with Image.open(candidate) as im:
            for label, width in [('full', w), ('medium', 640)]:
                im.resize((width, round(h*width/w)), Image.Resampling.LANCZOS).save(ART / f'{args.id}-{label}.webp', quality=95, method=6)
        (APP / 'combat-stage-art.gen.ts').write_text(
            f'// Generated by egg-snap-environment.py; geometry is owned by combat-stage-template.json.\n'
            f'export const ACTIVE_COMBAT_STAGE = "{args.id}" as const;\n'
            f'export const COMBAT_STAGE_SOURCES = {{ full: require("@incubator/art-world/backgrounds/duel-stages/{args.id}-full.webp"), medium: require("@incubator/art-world/backgrounds/duel-stages/{args.id}-medium.webp") }};\n', encoding='utf-8')
        save(APP / 'combat-stage-active.json', {'id': args.id})
        recipe.update(status='active', reviewNote=args.review_note)
        save(recipe_path, recipe)
    print(work)

if __name__ == '__main__':
    main()
