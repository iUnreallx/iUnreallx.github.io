// First screen: one cloud of points that becomes the name, then the work itself:
// a chip, the CAN bus, the car, a wheel, the app, the gauges and more. Scrolling scatters it.
(() => {
  const root = document.documentElement;
  const hero = document.getElementById('hero');
  if (!hero) return;
  const pin = hero.querySelector('.hero-pin');
  const canvas = document.getElementById('dust');
  const foot = hero.querySelector('.hero-foot');
  const shade = hero.querySelector('.hero-shade');
  const exit = hero.querySelector('.hero-exit');
  const cap = document.getElementById('hero-cap');
  const picks = [...hero.querySelectorAll('.pick')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WHITE = [239, 241, 235], LIME = [198, 242, 78], ORANGE = [255, 159, 10], BLUE = [90, 155, 255];
  const NARROW = 820;

  /* ── Figures that keep moving once they are formed ──── */
  const TAU = Math.PI * 2;
  const frac = v => v - Math.floor(v);

  // A car wheel in real 3D: rim, barrel, hub and ten spokes, turning and slowly tilting.
  const wheel = (r1, r2, now, box, o) => {
    const t = now * .001, R = Math.min(box.w, box.h) * .49;
    let a, rad, z;
    if (r1 < .42) { a = r2 * TAU; rad = R * (.9 + .1 * frac(r1 * 97)); z = (frac(r1 * 53) - .5) * R * .36; }
    else if (r1 < .56) { a = r2 * TAU; rad = R * .72; z = (frac(r1 * 71) - .5) * R * .28; }
    else if (r1 < .66) { a = r2 * TAU; rad = R * .2 * Math.sqrt(frac(r1 * 31)); z = R * .06; }
    else {
      const spoke = Math.floor(r2 * 10), along = .18 + frac(r1 * 113) * .56;
      a = spoke / 10 * TAU + (frac(r2 * 10) - .5) * .17 * (1 - along * .7);
      rad = R * along;
      z = (frac(r1 * 41) - .5) * R * .05;
    }
    a += t * 1.4;
    const tilt = .62 + Math.sin(t * .4) * .2;
    const X0 = Math.cos(a) * rad, Y0 = Math.sin(a) * rad;
    const X = X0 * Math.cos(tilt) + z * Math.sin(tilt), Z = -X0 * Math.sin(tilt) + z * Math.cos(tilt);
    const p = 1 / (1 + Z / (R * 5));
    o.x = box.cx + X * p;
    o.y = box.cy + Y0 * p;
    o.b = .45 + .55 * Math.max(0, Math.min(1, .5 - Z / (R * 1.6)));
  };

  // A CAN bus on a logic analyser: the two wires run across the top, splitting apart on every
  // dominant bit, and the row of cells under them is the same frame read out bit by bit.
  const BITS = [0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0];
  const CELLS = 16;
  const canBus = (r1, r2, now, box, o) => {
    const width = Math.min(box.w, box.h * 2.5), left = box.cx - width / 2;
    // Slow enough for the points to settle on every bit, so the wave stays square.
    const phase = now * .0013, shift = Math.floor(phase);
    if (r2 < .68) {
      // The wires. The picture slides left at a steady pace, one bit at a time.
      const q = r1 * CELLS + phase, k = Math.floor(q), f = q - k;
      const a = BITS[k % BITS.length], b = BITS[(k + 1) % BITS.length];
      const edge = f < .93 ? 0 : (f - .93) / .07;
      const v = a + (b - a) * edge * edge * (3 - 2 * edge);
      const high = r2 < .36;
      o.x = left + r1 * width;
      o.y = box.cy - box.h * .17 + (high ? -1 : 1) * (v * box.h * .2 + box.h * .014) + (frac(r2 * 19) - .5) * box.h * .016;
      o.b = high ? 1 : .8;
      o.c = high ? 1 : 2;
      return;
    }
    // The cells: filled for a dominant bit, an empty outline for a recessive one.
    const cell = Math.min(CELLS - 1, Math.floor(r1 * CELLS)), bit = BITS[(cell + shift) % BITS.length];
    const pitch = width / CELLS, size = pitch * .62;
    const gap = cell >= CELLS / 2 ? pitch * .18 : -pitch * .18;   // two bytes, a little apart
    let u = frac(r2 * 37.7), w = frac(r2 * 91.3);
    if (!bit) {
      const side = Math.floor(frac(r1 * 53.1) * 4);
      if (side === 0) w = 0; else if (side === 1) w = 1; else if (side === 2) u = 0; else u = 1;
    }
    o.x = left + (cell + .5) * pitch + gap + (u - .5) * size;
    o.y = box.cy + box.h * .3 + (w - .5) * size;
    o.b = bit ? 1 : .6;
    o.c = bit ? 3 : 2;
  };

  // What the points keep turning into, and how each change happens.
  const STORY = () => {
    const en = root.dataset.lang === 'en';
    const name = en ? 'Artyom' : 'Артём';
    return [
      { w: en ? 'Hello' : 'Привет', hold: 1300 },
      { w: name, hold: 4400, fx: 'sweep' },
      { shape: 'chip', c: ORANGE, cap: 'Embedded', hold: 2100, fx: 'scan' },
      { live: canBus, pal: [ORANGE, WHITE, LIME], c: ORANGE, cap: 'CAN bus', hold: 3400, fx: 'rain' },
      { shape: 'obd', c: ORANGE, cap: 'OBD-II', hold: 2000, fx: 'bloom' },
      { id: 'redrive', shape: 'car', c: LIME, cap: 'Automotive', project: 'redrive', hold: 2600, fx: 'vortex' },
      { shape: 'tacho', c: LIME, cap: 'Live data', hold: 2000, fx: 'scan' },
      { shape: 'battery', c: LIME, cap: '12.6 V', hold: 1800, fx: 'bloom' },
      { live: wheel, c: LIME, cap: 'Telemetry', hold: 2500, fx: 'burst' },
      { w: name, hold: 2600, fx: 'rain' },
      { shape: 'phone', c: LIME, cap: 'Flutter', project: 'redrive', hold: 2300, fx: 'scan' },
      { shape: 'bluetooth', c: BLUE, cap: 'Bluetooth', hold: 1800, fx: 'burst' },
      { shape: 'wifi', c: LIME, cap: 'Wi-Fi', hold: 1800, fx: 'bloom' },
      { w: '41 0C 1A F8', mono: true, c: ORANGE, cap: 'ELM327', hold: 1900, fx: 'burst' },
      { id: 'elm', shape: 'elm', c: ORANGE, cap: 'C++ / Qt', project: 'elm', hold: 2400, fx: 'vortex' },
      { shape: 'terminal', c: ORANGE, cap: en ? 'AT commands' : 'AT-команды', hold: 2000, fx: 'scan' },
      { shape: 'engine', c: ORANGE, cap: 'Check Engine', hold: 1900, fx: 'bloom' },
      { shape: 'gear', c: BLUE, cap: 'Firmware', hold: 1900, fx: 'rain' },
      { id: 'quanta', shape: 'quanta', c: BLUE, cap: 'Windows', project: 'quanta', hold: 2400, fx: 'bloom' },
      { shape: 'code', c: LIME, cap: 'Open source', hold: 1900, fx: 'vortex' },
    ];
  };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Two still layers cross-fade: repainting one full-screen gradient for every colour was the heaviest part.
  const firstGlow = hero.querySelector('.hero-glow');
  const glows = [firstGlow, firstGlow.cloneNode()];
  firstGlow.after(glows[1]);
  glows[0].classList.add('on');
  let glowAt = 0, glowNow = 'rgba(150, 165, 190, .12)';

  let capTimer = 0;
  const onShow = item => {
    picks.forEach(a => a.classList.toggle('on', !!item.project && a.dataset.project === item.project));
    const glow = item.c ? 'rgba(' + item.c.join(',') + ', .2)' : 'rgba(150, 165, 190, .12)';
    if (glow !== glowNow) {
      glowNow = glow;
      glowAt = 1 - glowAt;
      glows[glowAt].style.setProperty('--g', glow);
      glows[glowAt].classList.add('on');
      glows[1 - glowAt].classList.remove('on');
    }
    cap.classList.remove('on');
    clearTimeout(capTimer);
    capTimer = setTimeout(() => {
      cap.textContent = item.cap || '';
      if (item.c) cap.style.color = 'rgb(' + item.c.join(',') + ')';
      if (item.cap) cap.classList.add('on');
    }, 420);
  };

  const dust = new ParticleText(canvas, {
    count: w => (w < 800 ? 4200 : 12000),
    dust: .09,
    ink: () => WHITE,
    onShow,
    layout: (w, h) => {
      const narrow = w <= NARROW;
      return { cx: w / 2, cy: h * (narrow ? .34 : .43), fs: narrow ? Math.max(110, w * .3) : Math.min(w * .2, h * .42), maxW: w * (narrow ? .88 : .8) };
    },
    shapeBox: (w, h) => {
      const narrow = w <= NARROW;
      return { cx: w / 2, cy: h * (narrow ? .34 : .42), maxW: w * (narrow ? .9 : .68), maxH: h * (narrow ? .44 : .6) };
    },
  });
  dust.story = STORY();
  dust.loopFrom = 1;

  const place = () => dust.resize(pin.clientWidth, pin.clientHeight);
  place();
  addEventListener('resize', place);

  document.querySelectorAll('[data-set-lang]').forEach(b => b.addEventListener('click', () => {
    dust.setStory(STORY(), 1);
    if (reduce) dust.settle(performance.now());
  }));

  addEventListener('pointermove', e => dust.pointer(e.clientX, e.clientY), { passive: true });
  pin.addEventListener('pointerleave', () => dust.pointerOff());

  picks.forEach(a => {
    a.addEventListener('pointerenter', () => {
      if (dust.current < 0 || reduce) return;
      const index = dust.story.findIndex(s => s.id === a.dataset.project);
      dust.jump(index, performance.now());
    });
    a.addEventListener('pointerleave', () => {
      if (dust.current >= 0 && !reduce) dust.resume(performance.now(), 900);
    });
  });

  /* ── Short lines at the bottom left, one after another ── */
  const say = document.getElementById('hero-say');
  const PHRASES = () => {
    const stars = picks.reduce((s, a) => s + (parseInt(a.querySelector('[data-gh]').textContent, 10) || 0), 0);
    return root.dataset.lang === 'en' ? [
      'From microcontroller to interface.',
      'Hardware and UI in the same hands.',
      'Reading ECU data over OBD-II.',
      'I test without a car: I built the emulator.',
      'C++, Qt, Flutter and CAN.',
      stars + ' stars on GitHub.',
      'Open to work.',
    ] : [
      'От микроконтроллера до интерфейса.',
      'Железо и интерфейс в одних руках.',
      'Читаю данные с ЭБУ по OBD-II.',
      'Тестирую без машины: написал эмулятор.',
      'C++, Qt, Flutter и CAN.',
      stars + ' звёзд на GitHub.',
      'Открыт к работе.',
    ];
  };
  let sayAt = 0, sayTimer = 0;
  const writeSay = text => {
    say.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.setProperty('--i', i);
      say.append(s);
    });
    say.classList.remove('out');
  };
  const nextSay = () => {
    say.classList.add('out');
    sayTimer = setTimeout(() => {
      const list = PHRASES();
      sayAt = (sayAt + 1) % list.length;
      writeSay(list[sayAt]);
      sayTimer = setTimeout(nextSay, 3400);
    }, 360);
  };
  const startSay = () => {
    clearTimeout(sayTimer);
    sayAt = 0;
    writeSay(PHRASES()[0]);
    if (!reduce) sayTimer = setTimeout(nextSay, 4200);
  };
  startSay();
  document.querySelectorAll('[data-set-lang]').forEach(b => b.addEventListener('click', startSay));

  /* ── Frame ──────────────────────────────────────────── */
  let t0 = 0, footFree = false;
  const seen = new Map();
  // Touches the page only when the value really changed.
  const fade = (el, v) => { if (seen.get(el) !== v) { seen.set(el, v); el.style.opacity = v; } };
  const frame = now => {
    const span = hero.offsetHeight - pin.clientHeight;
    const p = reduce || span <= 0 ? 0 : clamp(-hero.getBoundingClientRect().top / span, 0, 1);
    const e = easeIO(p);

    // After the entrance the caption follows the scroll directly, without its fade-in transition.
    if (t0 && now - t0 > 2200 && !footFree) { footFree = true; foot.style.transition = 'none'; }
    fade(foot, root.classList.contains('intro') ? '' : (1 - smooth(0, .22, p)).toFixed(3));
    fade(cap, p > .01 ? (1 - smooth(0, .2, p)).toFixed(3) : '');
    fade(shade, (1 - smooth(0, .4, p)).toFixed(3));
    fade(exit, smooth(.66, 1, p).toFixed(3));
    fade(canvas, (1 - smooth(.3, .95, p)).toFixed(3));

    if (reduce) dust.draw(0, 0);
    else dust.frame(now, e * 2.4);
  };

  // The loop sleeps once the hero has scrolled away.
  let alive = true, looping = false;
  function wake() {
    if (looping || !alive) return;
    looping = true;
    dust.last = 0;
    requestAnimationFrame(loop);
  }
  function loop(now) {
    if (!alive) { looping = false; return; }
    frame(now);
    if (reduce) { looping = false; return; }
    requestAnimationFrame(loop);
  }
  if (reduce) addEventListener('resize', () => wake());   // one still frame, redrawn when the size changes
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { alive = en.isIntersecting; wake(); }, { rootMargin: '120px' }).observe(hero);
  }
  wake();

  const fonts = () => {
    if (!document.fonts) return Promise.resolve();
    const sample = '500 200px "Cormorant Garamond"';
    return Promise.all([document.fonts.load(sample, 'ПриветАртём'), document.fonts.load(sample, 'Hello Artyom'), document.fonts.load('400 200px "Martian Mono"', '41 0C 1A F8')]);
  };
  const begin = () => {
    t0 = performance.now();
    fonts().catch(() => {}).then(() => {
      dust.prepare();
      if (reduce) { dust.show(1, 0); dust.settle(performance.now()); wake(); }
      else dust.play(performance.now(), 0);
    });
  };
  if (root.classList.contains('intro')) document.addEventListener('intro-done', begin, { once: true });
  else begin();
})();
