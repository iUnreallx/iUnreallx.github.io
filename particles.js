// A cloud of points that keeps turning into something else: words, or shapes traced
// from the real projects. The cursor pushes points aside, and a slow ripple and a band
// of light keep the surface alive.
class ParticleText {
  /**
   * count(cssWidth): how many points to use.
   * dust: share of points that drift freely as stars instead of joining the figure.
   * layout(cssWidth, cssHeight): { cx, cy, fs, maxW } for words, in CSS pixels.
   * shapeBox(cssWidth, cssHeight): { cx, cy, maxW, maxH } for shapes.
   * ink(): default [r, g, b] for items without their own color.
   * onShow(item): called when a new item starts forming.
   */
  constructor(canvas, { count, dust = 0, layout, shapeBox, ink, onShow }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = { count, dust, layout, shapeBox, ink, onShow };
    this.cache = new Map();
    // Colours the figures bring with them. Index 0 is the live colour of the current item.
    this.pal = [''];
    this.palOf = new Map();
    this.story = [];
    this.loopFrom = 0;
    this.current = -1;
    this.phaseAt = Infinity;
    this.color = ink().slice();
    this.mx = this.my = -1e5;
    this.tiltX = this.tiltY = 0;
    this.acc = 0;
    this.last = 0;
    this.W = this.H = 0;
  }

  resize(cssW, cssH) {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    if (W === this.W && H === this.H) return;
    Object.assign(this, { dpr, W, H, cssW, cssH });
    this.canvas.width = W;
    this.canvas.height = H;
    const N = this.N = this.opts.count(cssW);
    this.wordN = Math.round(N * (1 - this.opts.dust));
    ['x', 'y', 'vx', 'vy', 'tx', 'ty', 'nx', 'ny', 'delay', 'b', 'tb', 'nb', 'r1', 'r2'].forEach(k => { this[k] = new Float32Array(N); });
    ['rx', 'ry', 'rw', 'rh'].forEach(k => { this[k] = new Int16Array(N); });
    this.link = new Int32Array(N);
    this.nc = new Uint8Array(N);
    this.tc = new Uint8Array(N);
    this.b.fill(1); this.tb.fill(1); this.nb.fill(1);
    for (let i = 0; i < N; i++) {
      this.r1[i] = Math.random();
      this.r2[i] = Math.random();
      this.x[i] = this.tx[i] = this.nx[i] = Math.random() * W;
      this.y[i] = this.ty[i] = this.ny[i] = Math.random() * H;
      if (i >= this.wordN) {
        this.vx[i] = (Math.random() - .5) * .22 * dpr;
        this.vy[i] = (Math.random() - .5) * .22 * dpr;
      }
    }
    this.cache.clear();
    if (this.current >= 0) {
      this.show(this.current, performance.now(), true);
      if (this.still) this.settle(performance.now());
    }
  }

  sampleWord(word, mono) {
    const { W, H, dpr } = this;
    const { cx, cy, fs: cssFs, maxW } = this.opts.layout(this.cssW, this.cssH);
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const g = off.getContext('2d', { willReadFrequently: true });
    const font = size => (mono ? '400 ' + size + 'px "Martian Mono", Consolas, monospace' : '500 ' + size + 'px "Cormorant Garamond", Georgia, serif');
    let fs = cssFs * dpr;
    g.font = font(fs);
    const limit = maxW * dpr, measured = g.measureText(word).width;
    if (measured > limit) { fs *= limit / measured; g.font = font(fs); }
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = g.strokeStyle = '#fff';
    g.lineWidth = fs * .012;
    const base = cy * dpr + fs * .3;
    g.fillText(word, cx * dpr, base);
    g.strokeText(word, cx * dpr, base);
    const data = g.getImageData(0, 0, W, H).data;
    const step = Math.max(1, Math.round(1.5 * dpr));
    const pts = [];
    for (let py = 0; py < H; py += step) {
      for (let px = 0; px < W; px += step) {
        if (data[(py * W + px) * 4 + 3] > 120) pts.push(px, py);
      }
    }
    return { pts, bri: null, col: null };
  }

  sampleShape(name) {
    const { a: aspect, d, p: palette } = window.SHAPES[name];
    const { dpr } = this;
    const box = this.opts.shapeBox(this.cssW, this.cssH);
    const h = Math.min(box.maxW / aspect, box.maxH) * dpr, w = h * aspect;
    const ox = box.cx * dpr - w / 2, oy = box.cy * dpr - h / 2;
    if (!this.palOf.has(name)) {
      this.palOf.set(name, this.pal.length);
      palette.forEach(c => this.pal.push('rgb(' + c.join(',') + ')'));
    }
    const first = this.palOf.get(name);
    // Five bytes a point: x and y in 12 bits each, brightness, colour.
    const bin = atob(d), n = bin.length / 5;
    const pts = new Float32Array(n * 2), bri = new Float32Array(n), col = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const b0 = bin.charCodeAt(i * 5), b1 = bin.charCodeAt(i * 5 + 1), b2 = bin.charCodeAt(i * 5 + 2);
      pts[i * 2] = ox + ((b0 << 4) | (b1 >> 4)) / 4095 * w;
      pts[i * 2 + 1] = oy + (((b1 & 15) << 8) | b2) / 4095 * h;
      bri[i] = bin.charCodeAt(i * 5 + 3) / 255;
      col[i] = first + bin.charCodeAt(i * 5 + 4);
    }
    return { pts, bri, col };
  }

  sample(item) {
    const key = item.shape ? '#' + item.shape : item.w;
    if (!this.cache.has(key)) this.cache.set(key, item.shape ? this.sampleShape(item.shape) : this.sampleWord(item.w, item.mono));
    return this.cache.get(key);
  }

  show(i, now, silent) {
    this.current = i;
    const item = this.story[i];
    const data = item.live ? null : this.sample(item);
    const count = data ? data.pts.length / 2 : 0;
    if (data && !count) return;
    const { nx, ny, nb, nc, delay, W, H, wordN, dpr } = this;
    const maxR = Math.hypot(W, H) / 2;
    // How the points leave the old figure and arrive at the new one.
    const fx = this.fx = item.fx || (item.shape || item.live ? 'bloom' : 'sweep');
    for (let p = 0; p < wordN; p++) {
      if (data) {
        // Places are handed out evenly, not by chance: no clumps, no holes, so the outline stays sharp.
        const k = count >= wordN ? Math.min(count - 1, Math.floor((p + Math.random()) * count / wordN)) : p % count;
        nx[p] = data.pts[k * 2] + (Math.random() - .5) * dpr * .7;
        ny[p] = data.pts[k * 2 + 1] + (Math.random() - .5) * dpr * .7;
        nb[p] = data.bri ? data.bri[k] : 1;
        nc[p] = data.col ? data.col[k] : 0;
      } else nc[p] = 0;
      const px = data ? nx[p] : Math.random() * W, py = data ? ny[p] : Math.random() * H;
      let wait;
      if (fx === 'scan') wait = py / H * 1100;
      else if (fx === 'rain') wait = Math.random() * 800;
      else if (fx === 'vortex') wait = 180 + Math.random() * 640;
      else if (fx === 'burst') wait = 240 + Math.random() * 360;
      else if (fx === 'bloom') wait = Math.hypot(px - W / 2, py - H / 2) / maxR * 760;
      else wait = px / W * 460;
      delay[p] = now + wait + Math.random() * 240;
    }
    this.phaseAt = now + item.hold + 900;
    if (!silent && this.opts.onShow) this.opts.onShow(item);
  }

  setStory(story, loopFrom = 0) {
    this.story = story;
    this.loopFrom = loopFrom;
    if (this.current >= 0) this.show(Math.min(this.current, story.length - 1), performance.now());
  }

  play(now, index = 0) { this.show(index, now); }

  // Decodes every figure ahead of time, so no change of figure has to stop and do it.
  prepare() { this.story.forEach(item => { if (!item.live) this.sample(item); }); }

  // Holds on one item until resume() is called.
  jump(index, now) { this.show(index, now); this.phaseAt = Infinity; }
  resume(now, after = 600) { this.phaseAt = now + after; }

  pointer(x, y) { this.mx = x * this.dpr; this.my = y * this.dpr; }
  pointerOff() { this.mx = this.my = -1e5; }

  physics(now) {
    const { x, y, vx, vy, tx, ty, nx, ny, b, tb, nb, nc, tc, delay, wordN, N, dpr, W, H, mx, my } = this;
    const item = this.story[this.current];
    const target = item && item.c ? item.c : this.opts.ink();
    for (let c = 0; c < 3; c++) this.color[c] += (target[c] - this.color[c]) * .05;
    const off = mx < -9e4;
    this.tiltX += ((off ? 0 : mx / W - .5) - this.tiltX) * .04;
    this.tiltY += ((off ? 0 : my / H - .5) - this.tiltY) * .04;
    const R = 130 * dpr, R2 = R * R, time = now * .0006;
    const live = item && item.live, fx = this.fx;
    const leaving = fx === 'rain' || fx === 'vortex' || fx === 'burst';
    const cx = W / 2, cy = H * .44;
    let box = null;
    const out = { x: 0, y: 0, b: 1, c: 0 };
    let liveFirst = 0;
    if (live) {
      // A moving figure may bring its own colours: out.c picks one, 0 keeps the live colour.
      if (item.pal) {
        const key = 'live:' + item.pal.join(';');
        if (!this.palOf.has(key)) {
          this.palOf.set(key, this.pal.length);
          item.pal.forEach(c => this.pal.push('rgb(' + c.join(',') + ')'));
        }
        liveFirst = this.palOf.get(key) - 1;
      }
      const s = this.opts.shapeBox(this.cssW, this.cssH);
      box = { cx: s.cx * dpr, cy: s.cy * dpr, w: s.maxW * dpr, h: s.maxH * dpr };
    }
    for (let i = 0; i < wordN; i++) {
      if (live) {
        live(this.r1[i], this.r2[i], now, box, out);
        nx[i] = out.x; ny[i] = out.y; nb[i] = out.b; nc[i] = out.c ? liveFirst + out.c : 0;
      }
      const waiting = now < delay[i];
      if (!waiting) { tx[i] = nx[i]; ty[i] = ny[i]; tb[i] = nb[i]; tc[i] = nc[i]; }
      b[i] += (tb[i] - b[i]) * .08;
      const dx = tx[i] - x[i], dy = ty[i] - y[i];
      const dist = Math.abs(dx) + Math.abs(dy);
      const pull = waiting && leaving ? .006 : .05;
      let ax = dx * pull, ay = dy * pull;
      if (waiting && leaving) {
        // Before a point heads for its new place, the old figure comes apart.
        const rx = x[i] - cx, ry = y[i] - cy;
        if (fx === 'rain') ay += .95 * dpr;
        else if (fx === 'vortex') { ax += -ry * .014 - rx * .004; ay += rx * .014 - ry * .004; }
        else { ax += rx * .02; ay += ry * .02; }
      }
      // On the way to a new figure each point swings along a curve; the swing fades as it arrives.
      const swing = Math.min(1, dist / (140 * dpr));
      ax += Math.sin(y[i] * .006 + time) * 1.5 * dpr * swing;
      ay += Math.cos(x[i] * .006 - time) * 1.5 * dpr * swing;
      const mdx = x[i] - mx, mdy = y[i] - my, d2 = mdx * mdx + mdy * mdy;
      if (d2 < R2) {
        const f = (1 - d2 / R2) * 5.4 * dpr / (Math.sqrt(d2) + 1);
        ax += mdx * f;
        ay += mdy * f;
      }
      vx[i] = (vx[i] + ax) * .82;
      vy[i] = (vy[i] + ay) * .82;
      x[i] += vx[i];
      y[i] += vy[i];
    }
    for (let i = wordN; i < N; i++) {
      x[i] += vx[i];
      y[i] += vy[i];
      if (x[i] < 0) x[i] += W; else if (x[i] > W) x[i] -= W;
      if (y[i] < 0) y[i] += H; else if (y[i] > H) y[i] -= H;
    }
  }

  // Runs the motion to its end at once: used when animation is turned off.
  settle(now) {
    this.still = true;
    this.delay.fill(0);
    for (let k = 0; k < 240; k++) this.physics(now);
    this.color = (this.story[this.current].c || this.opts.ink()).slice();
    this.draw(0, 0);
  }

  draw(spread, now) {
    const { ctx, x, y, vx, vy, b, tc, pal, wordN, N, W, H, dpr, color, tiltX, tiltY, rx, ry, rw, rh, link } = this;
    const ox = W / 2, oy = H * .44, k = 1 + spread;
    ctx.clearRect(0, 0, W, H);
    const live = 'rgb(' + (color[0] | 0) + ',' + (color[1] | 0) + ',' + (color[2] | 0) + ')';
    // Whole pixels only: sharper points, and far less work for the browser.
    const small = Math.max(1, Math.round(1.25 * dpr)), big = Math.max(2, Math.round(2 * dpr)), maxStreak = 7 * dpr;
    const t = now * .001, fx = .0036 / dpr, fy = .005 / dpr;
    const lift = 5 * dpr, tilt = 16 * dpr;
    // A soft band of light crosses the figure every few seconds.
    const bandX = ((t * .2) % 1.5 - .25) * W, bandR = 170 * dpr;
    // Points are grouped by colour and brightness, so both are set a few times per frame, not once per point.
    const LEVELS = 8, groups = pal.length * LEVELS;
    if (!this.head || this.head.length !== groups) this.head = new Int32Array(groups);
    const head = this.head.fill(-1);
    for (let i = 0; i < wordN; i++) {
      // The figure rides on a slow ripple, and the ripple also sets how bright each point is.
      const ripple = Math.sin(x[i] * fx + t * 1.1) * Math.cos(y[i] * fy - t * .8);
      const band = Math.max(0, 1 - Math.abs(x[i] - bandX) / bandR);
      const alpha = b[i] * (.76 + .24 * ripple) + band * band * .5;
      if (alpha < .05) continue;
      const s = i % 3 === 0 ? big : small;
      // A moving point stretches only along its main direction, so it reads as a thin streak.
      const ax = Math.abs(vx[i]), ay = Math.abs(vy[i]);
      const w = ax > ay ? s + Math.min(ax * .45, maxStreak) | 0 : s;
      const h = ay >= ax ? s + Math.min(ay * .45, maxStreak) | 0 : s;
      const px = ox + (x[i] - ox) * k + ripple * tiltX * tilt - (vx[i] > 0 ? w - s : 0);
      const py = oy + (y[i] - oy) * k + ripple * (lift + tiltY * tilt) - (vy[i] > 0 ? h - s : 0);
      if (px < -20 || py < -20 || px > W + 20 || py > H + 20) continue;
      rx[i] = px + .5 | 0; ry[i] = py + .5 | 0; rw[i] = w; rh[i] = h;
      const group = tc[i] * LEVELS + (alpha >= 1 ? LEVELS - 1 : alpha * LEVELS | 0);
      link[i] = head[group];
      head[group] = i;
    }
    for (let g = 0; g < groups; g++) {
      if (head[g] < 0) continue;
      ctx.fillStyle = g < LEVELS ? live : pal[g / LEVELS | 0];
      ctx.globalAlpha = (g % LEVELS + 1) / LEVELS;
      for (let i = head[g]; i >= 0; i = link[i]) ctx.fillRect(rx[i], ry[i], rw[i], rh[i]);
    }
    ctx.fillStyle = live;
    ctx.globalAlpha = .4;
    const star = Math.max(1, Math.round(dpr)), starBig = Math.max(2, Math.round(1.8 * dpr));
    for (let i = wordN; i < N; i++) {
      const s = i % 5 === 0 ? starBig : star;
      ctx.fillRect(ox + (x[i] - ox) * k + .5 | 0, oy + (y[i] - oy) * k + .5 | 0, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // Advances on a 60 Hz step, so it looks the same on any monitor.
  frame(now, spread = 0) {
    if (this.current >= 0 && now > this.phaseAt) {
      const next = this.current + 1 >= this.story.length ? this.loopFrom : this.current + 1;
      this.show(next, now);
    }
    const STEP = 1000 / 60;
    this.acc += Math.min(50, now - (this.last || now));
    this.last = now;
    // On a 60 Hz screen this is exactly one step per frame, without the double steps that read as judder.
    // A slow frame takes two steps at most, so one hiccup cannot snowball.
    const steps = Math.min(2, Math.round(this.acc / STEP));
    for (let n = 0; n < steps; n++) this.physics(now);
    this.acc = steps ? Math.max(-STEP, Math.min(STEP, this.acc - steps * STEP)) : this.acc;
    this.draw(spread, now);
  }
}
