import io

SHARED = """<style>
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap');
:root{
  --ink-950:#0C0A14; --ink-900:#14111F; --ink-800:#1C1830; --dusk-700:#272140;
  --line:rgba(196,186,240,.08);
  --moon-50:#F6F3FF; --moon-300:#C9C2E8; --moon-500:#908AB5;
  --ember-300:#FFC36B; --ember-500:#F58E3C; --ember-glow:rgba(245,142,60,.35);
  --violet:#A78BFA; --teal:#7DE8CD; --rose:#F49AC1;
}
*{box-sizing:border-box}
body{margin:0;background:#08070F;color:var(--moon-50);font-family:Manrope,system-ui,sans-serif;
  padding:36px;display:flex;flex-wrap:wrap;gap:36px;justify-content:center;align-items:flex-start}
.serif{font-family:'Instrument Serif',serif;font-weight:400}
.label{font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--moon-500)}
.label.ember{color:var(--ember-300)}
.phone{width:390px;min-height:844px;background:var(--ink-950);border-radius:48px;overflow:hidden;
  position:relative;box-shadow:0 40px 90px rgba(0,0,0,.65),inset 0 0 0 1px rgba(196,186,240,.07);
  display:flex;flex-direction:column}
.statusbar{display:flex;justify-content:space-between;align-items:center;padding:22px 30px 6px;
  font-size:14px;font-weight:700;color:var(--moon-300)}
.statusbar .pills{display:flex;gap:5px}
.statusbar .pills i{width:5px;height:5px;border-radius:99px;background:var(--moon-500);display:block}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;height:58px;padding:0 30px;
  border-radius:999px;font-weight:800;font-size:16px;letter-spacing:.01em}
.btn.lantern{background:linear-gradient(135deg,var(--ember-300),var(--ember-500));color:#21130A;
  box-shadow:0 8px 32px var(--ember-glow),0 2px 8px rgba(0,0,0,.4)}
.btn.quiet{background:var(--dusk-700);color:var(--moon-50)}
.btn.ghost{background:none;color:var(--moon-300);height:auto;padding:12px 16px;font-weight:700}
.btn.small{height:44px;padding:0 22px;font-size:14px}
.chip{display:inline-flex;align-items:center;gap:9px;background:var(--dusk-700);border-radius:999px;
  padding:11px 16px;font-size:14px;font-weight:600;color:var(--moon-50);position:relative}
.chip .dot{width:8px;height:8px;border-radius:99px;flex:none}
.card{background:var(--ink-900);border-radius:24px;padding:22px;
  box-shadow:0 14px 40px rgba(0,0,0,.35)}
.card.raised{background:var(--ink-800)}
.ring{border-radius:999px;padding:3px;background:conic-gradient(from 210deg,var(--violet),var(--teal),var(--ember-300),var(--violet))}
.ring>div{border-radius:999px;background:var(--ink-900);overflow:hidden;display:flex;align-items:center;justify-content:center}
.ring.faint{background:none;border:1.5px dashed rgba(201,194,232,.28);padding:4px}
.constellation{display:flex;align-items:center;gap:0;height:14px;margin:4px 0}
.constellation .seg{flex:1;border-top:1.5px dotted rgba(201,194,232,.22)}
.constellation .star{width:4px;height:4px;border-radius:99px;background:var(--moon-300);box-shadow:0 0 8px rgba(201,194,232,.8);margin:0 6px}
.spec{width:760px;background:var(--ink-900);border-radius:32px;padding:40px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.spec h1{font-family:'Instrument Serif',serif;font-weight:400;font-size:38px;margin:6px 0 6px}
.spec .sub{color:var(--moon-500);font-size:15px;line-height:1.6;max-width:560px;margin-bottom:30px}
.swatchrow{display:flex;gap:14px;flex-wrap:wrap;margin:18px 0 28px}
.swatch{width:108px;border-radius:18px;overflow:hidden;background:var(--ink-800)}
.swatch .c{height:74px}
.swatch .m{padding:10px 12px;font-size:11px;line-height:1.5;color:var(--moon-300)}
.swatch .m b{display:block;color:var(--moon-50);font-size:12px}
.tabbar{position:absolute;left:24px;right:24px;bottom:24px;height:68px;border-radius:999px;
  background:rgba(28,24,48,.92);box-shadow:0 18px 40px rgba(0,0,0,.5);backdrop-filter:blur(20px);
  display:flex;align-items:center;justify-content:space-around;padding:0 14px}
.tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;font-weight:700;
  letter-spacing:.08em;color:var(--moon-500);text-transform:uppercase}
.tab.active{color:var(--ember-300)}
.tab .ico{width:26px;height:26px;border-radius:9px;background:var(--dusk-700)}
.tab.active .ico{background:linear-gradient(135deg,var(--ember-300),var(--ember-500));box-shadow:0 4px 16px var(--ember-glow)}
.screenpad{padding:10px 24px 0;display:flex;flex-direction:column;flex:1}
.glowstage{position:relative;display:flex;align-items:center;justify-content:center}
.halo{position:absolute;border-radius:999px;filter:blur(40px)}
</style>"""


def page(path, group, title, body):
    html = (
        '<!-- @dsCard group="' + group + '" -->\n'
        '<!doctype html><html><head><meta charset="utf-8"><title>' + title + '</title>'
        + SHARED + '</head>\n<body>' + body + '</body></html>'
    )
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('wrote', path)


page('foundations/colors.html', 'Foundations', 'Lantern - Color', """
<div class="spec">
  <div class="label ember">Lantern / Foundations</div>
  <h1>Color &mdash; light is life</h1>
  <div class="sub">Violet-black ink for the world. Warmth appears only where something is alive (creatures, the egg) or where the user is invited to act &mdash; one amber lantern per screen. Everything else recedes into moonlight greys.</div>
  <div class="label">Ink &mdash; the night</div>
  <div class="swatchrow">
    <div class="swatch"><div class="c" style="background:#0C0A14"></div><div class="m"><b>ink-950</b>app background</div></div>
    <div class="swatch"><div class="c" style="background:#14111F"></div><div class="m"><b>ink-900</b>resting cards</div></div>
    <div class="swatch"><div class="c" style="background:#1C1830"></div><div class="m"><b>ink-800</b>raised cards</div></div>
    <div class="swatch"><div class="c" style="background:#272140"></div><div class="m"><b>dusk-700</b>chips &amp; inputs</div></div>
  </div>
  <div class="label">Moon &mdash; text</div>
  <div class="swatchrow">
    <div class="swatch"><div class="c" style="background:#F6F3FF"></div><div class="m"><b>moon-50</b>primary text</div></div>
    <div class="swatch"><div class="c" style="background:#C9C2E8"></div><div class="m"><b>moon-300</b>secondary</div></div>
    <div class="swatch"><div class="c" style="background:#908AB5"></div><div class="m"><b>moon-500</b>labels, tertiary</div></div>
  </div>
  <div class="label">Ember &mdash; the lantern</div>
  <div class="swatchrow">
    <div class="swatch"><div class="c" style="background:#FFC36B"></div><div class="m"><b>ember-300</b>gradient start</div></div>
    <div class="swatch"><div class="c" style="background:#F58E3C"></div><div class="m"><b>ember-500</b>gradient end</div></div>
    <div class="swatch"><div class="c" style="background:linear-gradient(135deg,#FFC36B,#F58E3C);box-shadow:0 8px 28px rgba(245,142,60,.45)"></div><div class="m"><b>lantern</b>the one CTA</div></div>
  </div>
  <div class="label">Aurora &mdash; supporting accents</div>
  <div class="swatchrow">
    <div class="swatch"><div class="c" style="background:#A78BFA"></div><div class="m"><b>aurora-violet</b>rings, magic</div></div>
    <div class="swatch"><div class="c" style="background:#7DE8CD"></div><div class="m"><b>aurora-teal</b>places, success</div></div>
    <div class="swatch"><div class="c" style="background:#F49AC1"></div><div class="m"><b>aurora-rose</b>social warmth</div></div>
  </div>
</div>""")

page('foundations/typography.html', 'Foundations', 'Lantern - Typography', """
<div class="spec">
  <div class="label ember">Lantern / Foundations</div>
  <h1>Typography</h1>
  <div class="sub">Instrument Serif carries identity &mdash; creature names in italic, screen titles in roman, never under 24px. Manrope does all the work below that. Two families, no exceptions.</div>
  <div style="display:flex;flex-direction:column;gap:30px">
    <div><div class="label">Creature name &middot; Instrument Serif italic 60</div>
      <div class="serif" style="font-size:60px;font-style:italic;line-height:1.05;margin-top:8px">Baristabbit</div></div>
    <div><div class="label">Screen title &middot; Instrument Serif 40</div>
      <div class="serif" style="font-size:40px;line-height:1.1;margin-top:8px">Your day becomes<br>a character.</div></div>
    <div><div class="label">Reflection quote &middot; Instrument Serif italic 24</div>
      <div class="serif" style="font-style:italic;font-size:24px;line-height:1.35;color:var(--moon-300);margin-top:8px">&ldquo;Third visit this week &mdash; your coffee ritual is starting to leave a signature.&rdquo;</div></div>
    <div><div class="label">Body &middot; Manrope 16/24</div>
      <div style="font-size:16px;line-height:24px;color:var(--moon-300);max-width:520px;margin-top:8px">Steps and places quietly shape the egg through the day. Quick tags, photos, and little notes feed it by hand. When your evening arrives, the day is revealed.</div></div>
    <div><div class="label">Secondary &middot; Manrope 14/20 &nbsp;&nbsp;|&nbsp;&nbsp; Label &middot; Manrope 12 caps 0.18em</div>
      <div style="font-size:14px;line-height:20px;color:var(--moon-500);margin-top:8px">A quieter thread of focus underneath.</div>
      <div class="label" style="margin-top:10px;color:var(--ember-300)">Coffee shop &middot; 3rd visit</div></div>
  </div>
</div>""")

page('foundations/surfaces.html', 'Foundations', 'Lantern - Surfaces & Motion', """
<div class="spec">
  <div class="label ember">Lantern / Foundations</div>
  <h1>Surfaces, shape &amp; motion</h1>
  <div class="sub">Cards are borderless &mdash; elevation comes from layered shadow, and colored glow is reserved for living things. Hairlines exist only on inputs. Radii: 16 / 24 / 32 / pill.</div>
  <div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap;margin-bottom:34px">
    <div class="card" style="width:200px;height:120px"><div class="label">surface 1</div><div style="font-size:14px;color:var(--moon-300);margin-top:6px">resting card<br>ink-900 &middot; r24</div></div>
    <div class="card raised" style="width:200px;height:140px"><div class="label">surface 2</div><div style="font-size:14px;color:var(--moon-300);margin-top:6px">raised card<br>ink-800 &middot; deeper shadow</div></div>
    <div class="card raised" style="width:200px;height:160px;box-shadow:0 14px 40px rgba(0,0,0,.35),0 0 60px rgba(167,139,250,.25)">
      <div class="label" style="color:var(--violet)">alive</div><div style="font-size:14px;color:var(--moon-300);margin-top:6px">glow surface &mdash; only for creatures, the egg, and the lantern CTA</div></div>
  </div>
  <div class="label">Constellation divider &mdash; replaces hard borders between sections</div>
  <div class="constellation" style="max-width:520px;margin:14px 0 30px"><div class="seg"></div><div class="star"></div><div class="seg"></div><div class="star"></div><div class="seg"></div><div class="star"></div><div class="seg"></div></div>
  <div class="label">Motion</div>
  <div style="font-size:15px;line-height:1.7;color:var(--moon-300);max-width:560px;margin-top:8px">
    Springs (stiffness 180, damping 18) for anything alive: egg breathing, chips landing, creature float. Timing curves for chrome: 240ms standard, 420ms reveals. The hatch is the only full-screen takeover. The existing drag-membrane and breathing physics are brand &mdash; keep them.</div>
</div>""")

page('components/buttons.html', 'Components', 'Lantern - Buttons', """
<div class="spec">
  <div class="label ember">Lantern / Components</div>
  <h1>Buttons</h1>
  <div class="sub">One lantern per screen &mdash; the single warm action. Quiet dusk pills for secondary, bare text for tertiary. No bordered buttons anywhere.</div>
  <div style="display:flex;flex-direction:column;gap:18px;max-width:360px">
    <div class="btn lantern">Reveal the hatch</div>
    <div class="btn lantern small" style="align-self:flex-start">Add a moment</div>
    <div class="btn quiet">Share postcard</div>
    <div class="btn quiet small" style="align-self:flex-start">View day map</div>
    <div class="btn ghost" style="align-self:flex-start">Skip for now</div>
  </div>
</div>""")

page('components/chips.html', 'Components', 'Lantern - Chips & Cues', """
<div class="spec">
  <div class="label ember">Lantern / Components</div>
  <h1>Glow chips &amp; cues</h1>
  <div class="sub">Moment chips lose their borders: dusk pill, colored dot, soft matching bloom. The encounter cue pill is the one bordered element &mdash; it frames identity like a museum tag.</div>
  <div class="label">Moment chips</div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin:14px 0 30px">
    <div class="chip"><span class="dot" style="background:#F3B788;box-shadow:0 0 14px #F3B788AA"></span>Coffee</div>
    <div class="chip"><span class="dot" style="background:#92D7FF;box-shadow:0 0 14px #92D7FFAA"></span>Walk</div>
    <div class="chip"><span class="dot" style="background:#F49AC1;box-shadow:0 0 14px #F49AC1AA"></span>Social</div>
    <div class="chip"><span class="dot" style="background:#A78BFA;box-shadow:0 0 14px #A78BFAAA"></span>Inspiration</div>
    <div class="chip"><span class="dot" style="background:#7DE8CD;box-shadow:0 0 14px #7DE8CDAA"></span>New place</div>
  </div>
  <div class="label">Passive signals &mdash; one quiet line, not chip noise</div>
  <div style="display:flex;align-items:center;gap:10px;color:var(--moon-500);font-size:14px;font-weight:600;margin:14px 0 30px">
    <span>6,420 steps</span><span style="opacity:.4">&middot;</span><span>3 places</span><span style="opacity:.4">&middot;</span><span style="color:var(--teal)">1 new</span>
  </div>
  <div class="label">Encounter cue pill</div>
  <div style="display:inline-flex;border:1.5px solid #E3B68C66;border-radius:999px;padding:10px 22px;margin-top:14px">
    <span class="label" style="color:#E3B68C">Coffee shop &middot; 3rd visit</span>
  </div>
</div>""")

page('components/cards.html', 'Components', 'Lantern - Cards & Rings', """
<div class="spec">
  <div class="label ember">Lantern / Components</div>
  <h1>Cards, rings &amp; rows</h1>
  <div class="sub">The aurora ring marks hatched days; forming days get a faint dashed moon ring. Reflections read as quotes, not data.</div>
  <div style="display:flex;gap:28px;align-items:center;margin:10px 0 32px">
    <div style="text-align:center"><div class="ring" style="width:84px;height:84px"><div style="width:100%;height:100%"><img src="../assets/mossprout.png" style="width:74%;margin-top:8px"></div></div>
      <div style="font-size:11px;font-weight:700;color:var(--moon-300);margin-top:8px">TUE</div></div>
    <div style="text-align:center"><div class="ring" style="width:84px;height:84px"><div style="width:100%;height:100%"><img src="../assets/baristabbit.png" style="width:74%;margin-top:8px"></div></div>
      <div style="font-size:11px;font-weight:700;color:var(--moon-300);margin-top:8px">WED</div></div>
    <div style="text-align:center"><div class="ring faint" style="width:84px;height:84px"><div style="width:100%;height:100%;background:var(--ink-800);display:flex;align-items:center;justify-content:center"><img src="../assets/egg-base.png" style="width:52%"></div></div>
      <div style="font-size:11px;font-weight:700;color:var(--ember-300);margin-top:8px">TODAY</div></div>
    <div style="text-align:center"><div style="width:84px;height:84px;border-radius:999px;border:1.5px dashed rgba(201,194,232,.16)"></div>
      <div style="font-size:11px;font-weight:700;color:var(--moon-500);margin-top:8px">TOMORROW</div></div>
  </div>
  <div class="label">Reflection card</div>
  <div class="card raised" style="max-width:480px;margin-top:12px">
    <div class="label" style="color:#E3B68C">Baristabbit remembers</div>
    <div class="serif" style="font-style:italic;font-size:22px;line-height:1.4;margin-top:10px;color:var(--moon-50)">&ldquo;A third time finding the same corner, the same warmth. There&rsquo;s a quiet pride in knowing what you need.&rdquo;</div>
  </div>
</div>""")

page('components/navigation.html', 'Components', 'Lantern - Navigation & Pickers', """
<div class="spec">
  <div class="label ember">Lantern / Components</div>
  <h1>Navigation &amp; pickers</h1>
  <div class="sub">A floating pill tab bar detached from the edge; the active tab burns. The hatch-hour dial is a row of lantern pills &mdash; the chosen hour glows.</div>
  <div style="position:relative;height:110px;max-width:420px;margin-bottom:20px">
    <div class="tabbar" style="position:absolute;left:0;right:0;bottom:10px">
      <div class="tab active"><div class="ico"></div>Today</div>
      <div class="tab"><div class="ico"></div>Collection</div>
      <div class="tab"><div class="ico"></div>World</div>
    </div>
  </div>
  <div class="label">Hatch hour dial</div>
  <div style="display:flex;gap:12px;margin-top:14px">
    <div class="chip" style="padding:14px 22px;color:var(--moon-500)">7 PM</div>
    <div class="chip" style="padding:14px 22px;color:var(--moon-500)">8 PM</div>
    <div class="btn lantern small" style="height:47px">9 PM</div>
    <div class="chip" style="padding:14px 22px;color:var(--moon-500)">10 PM</div>
  </div>
</div>""")

print('foundations + components done')
