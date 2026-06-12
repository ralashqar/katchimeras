from gen_foundations import page

STATUS = """<div class="statusbar"><span>21:47</span><div class="pills"><i></i><i></i><i></i></div></div>"""

TABBAR = """<div class="tabbar">
  <div class="tab active"><div class="ico"></div>Today</div>
  <div class="tab"><div class="ico"></div>Collection</div>
  <div class="tab"><div class="ico"></div>World</div>
</div>"""

TIMELINE = """
<div style="display:flex;gap:16px;justify-content:center;align-items:flex-start;margin:6px 0 4px">
  <div style="text-align:center"><div class="ring" style="width:58px;height:58px"><div style="width:100%;height:100%"><img src="../assets/gatherglow.png" style="width:76%;margin-top:5px"></div></div><div style="font-size:10px;font-weight:700;color:var(--moon-500);margin-top:6px">SUN</div></div>
  <div style="text-align:center"><div class="ring" style="width:58px;height:58px"><div style="width:100%;height:100%"><img src="../assets/mossprout.png" style="width:76%;margin-top:5px"></div></div><div style="font-size:10px;font-weight:700;color:var(--moon-500);margin-top:6px">MON</div></div>
  <div style="text-align:center"><div class="ring" style="width:58px;height:58px"><div style="width:100%;height:100%"><img src="../assets/baristabbit.png" style="width:76%;margin-top:5px"></div></div><div style="font-size:10px;font-weight:700;color:var(--moon-500);margin-top:6px">TUE</div></div>
  <div style="text-align:center"><div class="ring faint" style="width:58px;height:58px"><div style="width:100%;height:100%;background:var(--ink-800);display:flex;align-items:center;justify-content:center"><img src="../assets/egg-base.png" style="width:50%"></div></div><div style="font-size:10px;font-weight:800;color:var(--ember-300);margin-top:6px">TODAY</div></div>
  <div style="text-align:center"><div style="width:58px;height:58px;border-radius:999px;border:1.5px dashed rgba(201,194,232,.15)"></div><div style="font-size:10px;font-weight:700;color:var(--moon-500);margin-top:6px">TMRW</div></div>
</div>"""

page('screens/home-today.html', 'Screens', 'Lantern - Home (forming)', """
<div class="phone">""" + STATUS + TIMELINE + """
  <div class="screenpad" style="align-items:center;text-align:center">
    <div class="glowstage" style="height:330px;width:100%;margin-top:6px">
      <div class="halo" style="width:230px;height:230px;background:rgba(167,139,250,.20)"></div>
      <div class="halo" style="width:130px;height:130px;background:rgba(255,180,84,.16)"></div>
      <img src="../assets/egg-base.png" style="width:215px;position:relative">
    </div>
    <div class="label" style="margin-top:2px">Gathering shape</div>
    <div class="serif" style="font-size:27px;line-height:1.25;margin:10px 0 2px;max-width:300px">The day is settling<br>into the egg.</div>
    <div style="display:flex;align-items:center;gap:10px;color:var(--moon-500);font-size:13px;font-weight:600;margin:14px 0 2px">
      <span>6,420 steps</span><span style="opacity:.4">&middot;</span><span>3 places</span><span style="opacity:.4">&middot;</span><span style="color:var(--teal)">1 new</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:16px 0 0">
      <div class="chip" style="padding:9px 14px;font-size:13px"><span class="dot" style="background:#F3B788;box-shadow:0 0 12px #F3B788AA"></span>Coffee</div>
      <div class="chip" style="padding:9px 14px;font-size:13px"><span class="dot" style="background:#92D7FF;box-shadow:0 0 12px #92D7FFAA"></span>Walk</div>
      <div class="chip" style="padding:9px 14px;font-size:13px;color:var(--moon-500)">+ note</div>
    </div>
    <div style="flex:1"></div>
    <div class="btn lantern" style="width:100%;margin-bottom:116px">Add a moment</div>
  </div>""" + TABBAR + """
</div>""")

page('screens/home-hatched.html', 'Screens', 'Lantern - Home (hatched)', """
<div class="phone">""" + STATUS + TIMELINE + """
  <div class="screenpad" style="align-items:center;text-align:center">
    <div class="glowstage" style="height:312px;width:100%">
      <div class="halo" style="width:250px;height:250px;background:rgba(227,182,140,.22)"></div>
      <img src="../assets/baristabbit.png" style="width:255px;position:relative;filter:drop-shadow(0 18px 30px rgba(0,0,0,.45))">
    </div>
    <div class="label ember" style="color:#E3B68C">Coffee shop &middot; 3rd visit</div>
    <div class="serif" style="font-size:56px;font-style:italic;line-height:1;margin:8px 0 0">Baristabbit</div>
    <div class="card raised" style="width:100%;margin-top:18px;text-align:left">
      <div class="label" style="color:#E3B68C">Baristabbit remembers</div>
      <div class="serif" style="font-style:italic;font-size:19px;line-height:1.45;margin-top:8px">&ldquo;A third time finding the same corner, the same warmth. There&rsquo;s a quiet pride in knowing what you need.&rdquo;</div>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;gap:12px;width:100%;margin-bottom:116px">
      <div class="btn quiet" style="flex:1">Day map</div>
      <div class="btn lantern" style="flex:1.4">Share postcard</div>
    </div>
  </div>""" + TABBAR + """
</div>""")

page('screens/hatch-reveal.html', 'Screens', 'Lantern - Hatch reveal', """
<div class="phone" style="background:radial-gradient(circle at 50% 38%, #1A1430 0%, #0C0A14 62%)">""" + STATUS + """
  <div class="screenpad" style="align-items:center;text-align:center;justify-content:center">
    <div class="label" style="letter-spacing:.24em">Revealing</div>
    <div class="serif" style="font-size:34px;line-height:1.15;margin:12px 0 6px">The hatch is<br>almost visible.</div>
    <div class="glowstage" style="height:380px;width:100%">
      <div class="halo" style="width:280px;height:280px;background:rgba(255,180,84,.26)"></div>
      <div class="halo" style="width:150px;height:150px;background:rgba(255,210,140,.30)"></div>
      <img src="../assets/egg-crack-2.png" style="width:235px;position:relative">
      <div class="chip" style="position:absolute;top:24px;left:18px;padding:8px 13px;font-size:12px;opacity:.65;transform:rotate(-5deg)"><span class="dot" style="background:#F3B788"></span>Coffee</div>
      <div class="chip" style="position:absolute;top:58px;right:14px;padding:8px 13px;font-size:12px;opacity:.55;transform:rotate(4deg)"><span class="dot" style="background:#92D7FF"></span>Walk</div>
      <div class="chip" style="position:absolute;bottom:40px;left:34px;padding:8px 13px;font-size:12px;opacity:.5;transform:rotate(3deg)"><span class="dot" style="background:#7DE8CD"></span>New place</div>
    </div>
    <div style="font-size:15px;line-height:1.55;color:var(--moon-300);max-width:280px">One form is about to carry the whole day forward.</div>
    <div class="btn ghost" style="margin-top:18px">Skip</div>
  </div>
</div>""")

page('screens/onboarding-cast.html', 'Screens', 'Lantern - Onboarding (cast)', """
<div class="phone">""" + STATUS + """
  <div class="screenpad">
    <div class="label ember" style="margin-top:14px">Meet a few of them</div>
    <div class="serif" style="font-size:40px;line-height:1.08;margin:10px 0 8px">Your days become<br>characters.</div>
    <div style="font-size:15px;line-height:1.55;color:var(--moon-300);max-width:320px">Each one appears because of something you actually did &mdash; and returns the more your ritual does.</div>
    <div style="display:flex;flex-direction:column;gap:14px;margin-top:24px">
      <div class="card raised" style="display:flex;align-items:center;gap:18px;padding:16px 20px">
        <div class="glowstage" style="width:88px;height:88px;flex:none"><div class="halo" style="width:70px;height:70px;background:rgba(227,182,140,.3)"></div><img src="../assets/baristabbit.png" style="width:84px;position:relative"></div>
        <div style="text-align:left"><div class="serif" style="font-size:25px;font-style:italic">Baristabbit</div>
        <div style="font-size:13.5px;line-height:1.45;color:var(--moon-300);margin-top:3px">Appears when your day keeps a coffee ritual.</div></div>
      </div>
      <div class="card raised" style="display:flex;align-items:center;gap:18px;padding:16px 20px">
        <div class="glowstage" style="width:88px;height:88px;flex:none"><div class="halo" style="width:70px;height:70px;background:rgba(143,216,190,.28)"></div><img src="../assets/mossprout.png" style="width:84px;position:relative"></div>
        <div style="text-align:left"><div class="serif" style="font-size:25px;font-style:italic">Mossprout</div>
        <div style="font-size:13.5px;line-height:1.45;color:var(--moon-300);margin-top:3px">Grows out of park walks and green detours.</div></div>
      </div>
      <div class="card raised" style="display:flex;align-items:center;gap:18px;padding:16px 20px">
        <div class="glowstage" style="width:88px;height:88px;flex:none"><div class="halo" style="width:70px;height:70px;background:rgba(184,156,232,.3)"></div><img src="../assets/flickerbun.png" style="width:84px;position:relative"></div>
        <div style="text-align:left"><div class="serif" style="font-size:25px;font-style:italic">Flickerbun</div>
        <div style="font-size:13.5px;line-height:1.45;color:var(--moon-300);margin-top:3px">Saves a seat for your cinema nights.</div></div>
      </div>
    </div>
    <div class="constellation" style="margin:20px 0 12px"><div class="seg"></div><div class="star"></div><div class="seg"></div><div class="star"></div><div class="seg"></div></div>
    <div style="font-size:14px;line-height:1.5;color:var(--moon-500);text-align:center;max-width:300px;align-self:center">Return to a ritual and the same character comes back &mdash; and remembers.</div>
    <div style="flex:1"></div>
    <div class="btn lantern" style="margin-bottom:28px">Continue</div>
  </div>
</div>""")

page('screens/onboarding-ritual.html', 'Screens', 'Lantern - Onboarding (ritual)', """
<div class="phone">""" + STATUS + """
  <div class="screenpad" style="align-items:center;text-align:center">
    <div class="label ember" style="margin-top:14px">The evening ritual</div>
    <div class="serif" style="font-size:40px;line-height:1.08;margin:10px 0 8px">A day gathers,<br>then hatches.</div>
    <div style="font-size:15px;line-height:1.55;color:var(--moon-300);max-width:310px">Steps and places quietly shape the egg. When your evening arrives, the day is revealed.</div>
    <div class="glowstage" style="height:280px;width:100%">
      <div class="halo" style="width:200px;height:200px;background:rgba(167,139,250,.2)"></div>
      <div class="halo" style="width:110px;height:110px;background:rgba(255,180,84,.18)"></div>
      <img src="../assets/egg-base.png" style="width:185px;position:relative">
    </div>
    <div class="label">Your hatch time</div>
    <div style="display:flex;gap:10px;margin:14px 0 4px">
      <div class="chip" style="padding:13px 19px;color:var(--moon-500)">7 PM</div>
      <div class="chip" style="padding:13px 19px;color:var(--moon-500)">8 PM</div>
      <div class="btn lantern small" style="height:45px">9 PM</div>
      <div class="chip" style="padding:13px 19px;color:var(--moon-500)">10 PM</div>
    </div>
    <div style="font-size:13px;color:var(--moon-500)">You can change this any time.</div>
    <div style="flex:1"></div>
    <div class="btn lantern" style="width:100%;margin-bottom:28px">Continue</div>
  </div>
</div>""")

page('screens/postcard.html', 'Screens', 'Lantern - Share postcard', """
<div style="width:420px;background:linear-gradient(165deg,#16112B 0%,#0C0A14 55%,#1A1226 100%);border-radius:36px;padding:34px 30px;box-shadow:0 40px 90px rgba(0,0,0,.65);position:relative;overflow:hidden;aspect-ratio:4/5;display:flex;flex-direction:column;align-items:center;text-align:center">
  <div style="position:absolute;top:60px;right:-70px;width:280px;height:280px;border-radius:999px;background:rgba(227,182,140,.10);filter:blur(30px)"></div>
  <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
    <span class="label" style="font-size:13px;color:var(--moon-300)">Katchimeras</span>
    <span style="font-size:14px;font-weight:700;color:var(--moon-500)">Thursday &middot; Jun 12</span>
  </div>
  <div class="glowstage" style="height:300px;width:100%;margin-top:10px">
    <div class="halo" style="width:240px;height:240px;background:rgba(227,182,140,.25)"></div>
    <img src="../assets/baristabbit.png" style="width:250px;position:relative;filter:drop-shadow(0 20px 34px rgba(0,0,0,.5))">
  </div>
  <div class="serif" style="font-size:52px;font-style:italic;line-height:1">Baristabbit</div>
  <div class="serif" style="font-style:italic;font-size:19px;line-height:1.45;color:var(--moon-300);max-width:320px;margin-top:12px">&ldquo;You found your rhythm again with coffee twice over, and a walk that steadied your Thursday.&rdquo;</div>
  <div style="display:inline-flex;border:1.5px solid #E3B68C66;border-radius:999px;padding:9px 20px;margin-top:16px">
    <span class="label" style="color:#E3B68C;font-size:11px">Coffee shop &middot; 3rd visit</span>
  </div>
  <div style="flex:1"></div>
  <div class="constellation" style="width:70%"><div class="seg"></div><div class="star"></div><div class="seg"></div><div class="star"></div><div class="seg"></div></div>
</div>""")

page('screens/collection.html', 'Screens', 'Lantern - Collection', """
<div class="phone">""" + STATUS + """
  <div class="screenpad">
    <div class="label ember" style="margin-top:14px">June</div>
    <div class="serif" style="font-size:40px;line-height:1.08;margin:8px 0 4px">Your month,<br>so far.</div>
    <div style="font-size:14px;color:var(--moon-500);margin-bottom:20px">11 days hatched &middot; 6 characters met</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px 10px;justify-items:center">
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/gatherglow.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/bedrotte.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/mossprout.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/baristabbit.png" style="width:78%;margin-top:4px"></div></div>
      <div style="width:56px;height:56px;border-radius:999px;background:var(--ink-900)"></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/sprintail.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/baristabbit.png" style="width:78%;margin-top:4px"></div></div>
      <div style="width:56px;height:56px;border-radius:999px;background:var(--ink-900)"></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/quietome.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/shellio.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/errandimp.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring" style="width:56px;height:56px"><div style="width:100%;height:100%"><img src="../assets/baristabbit.png" style="width:78%;margin-top:4px"></div></div>
      <div class="ring faint" style="width:56px;height:56px"><div style="width:100%;height:100%;background:var(--ink-800);display:flex;align-items:center;justify-content:center"><img src="../assets/egg-base.png" style="width:48%"></div></div>
      <div style="width:56px;height:56px;border-radius:999px;border:1.5px dashed rgba(201,194,232,.12)"></div>
      <div style="width:56px;height:56px;border-radius:999px;border:1.5px dashed rgba(201,194,232,.12)"></div>
    </div>
    <div class="constellation" style="margin:24px 0 14px"><div class="seg"></div><div class="star"></div><div class="seg"></div><div class="star"></div><div class="seg"></div></div>
    <div class="card raised" style="display:flex;align-items:center;gap:16px">
      <div class="glowstage" style="width:64px;height:64px;flex:none"><div class="halo" style="width:52px;height:52px;background:rgba(227,182,140,.3)"></div><img src="../assets/baristabbit.png" style="width:60px;position:relative"></div>
      <div><div class="label" style="color:#E3B68C">Deepest bond</div>
      <div style="font-size:15px;font-weight:700;margin-top:3px">Baristabbit &middot; 3 visits</div></div>
    </div>
    <div style="flex:1"></div>
  </div>""" + TABBAR + """
</div>""")

print('screens done')
