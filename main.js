(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const lang = () => root.dataset.lang;

  /* ── Headlines that fill their column ───────────────── */
  const fit = el => {
    const inner = $('.fit-in', el);
    if (!inner) return;
    el.style.fontSize = '100px';
    const w = inner.offsetWidth;
    const avail = el.clientWidth;
    if (!w || !avail) return;
    let size = 100 * avail / w;
    const maxVh = parseFloat(el.dataset.maxVh);
    if (maxVh) size = Math.min(size, innerHeight * maxVh / 100);
    el.style.fontSize = size.toFixed(2) + 'px';
  };
  const fitAll = () => $$('.fit').forEach(fit);
  fitAll();
  if (document.fonts) document.fonts.ready.then(fitAll);
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;   // phone URL bars change only the height
    lastW = innerWidth;
    fitAll();
  });

  /* ── Language ───────────────────────────────────────── */
  const TITLES = { ru: 'Unreallx', en: 'Unreallx' };
  const ruText = new WeakMap();   // the Russian originals of translated attributes
  const swapAttr = (el, attr, en, l) => {
    if (!ruText.has(el)) ruText.set(el, el.getAttribute(attr));
    el.setAttribute(attr, l === 'en' ? en : ruText.get(el));
  };
  const applyLang = l => {
    root.dataset.lang = l;
    root.lang = l;
    document.title = TITLES[l];
    $$('[data-aria-en]').forEach(el => swapAttr(el, 'aria-label', el.dataset.ariaEn, l));
    $$('img[data-alt-en]').forEach(img => swapAttr(img, 'alt', img.dataset.altEn, l));
  };
  applyLang(lang());
  $$('[data-set-lang]').forEach(b => b.addEventListener('click', () => {
    const l = b.dataset.setLang;
    store.set('lang', l);
    applyLang(l);
    fitAll();
    byeLang();
    resetTalk();
  }));

  /* ── Theme: dark by default ─────────────────────────── */
  const metaTheme = $('meta[name="theme-color"]');
  const syncMeta = () => metaTheme.setAttribute('content', root.dataset.theme === 'light' ? '#F1F0EA' : '#0A0B0C');
  syncMeta();
  $('#theme').addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    store.set('theme', next);
    syncMeta();
  });

  /* ── Reveal on scroll ───────────────────────────────── */
  const revealEls = $$('.reveal, .title');
  if (reduce || !('IntersectionObserver' in window)) {
    revealEls.forEach(el => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(el => io.observe(el));
  }

  /* ── Page accent follows the project in view ────────── */
  let channel = 'redrive';
  const setCh = c => { root.dataset.ch = c; };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      channel = e.target.dataset.channel;
      setCh(channel);
    }), { rootMargin: '-48% 0px -48% 0px' });
    $$('[data-channel]').forEach(el => io.observe(el));
    const hero = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { channel = 'redrive'; setCh(channel); }
    }, { rootMargin: '-48% 0px -48% 0px' });
    hero.observe($('.hero'));
  }

  /* ── Hairline under the bar, gentle depth on the stages ─ */
  const bar = $('#bar');
  const heroEl = $('#hero');
  const depthEls = reduce ? [] : $$('[data-depth]');
  const wide = matchMedia('(min-width: 821px)');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    bar.classList.toggle('is-stuck', heroEl.getBoundingClientRect().bottom <= bar.offsetHeight);
    const vh = innerHeight;
    depthEls.forEach(el => {
      if (!wide.matches) { el.style.transform = ''; return; }
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const offset = (r.top + r.height / 2 - vh / 2) - (parseFloat(el.dataset.y) || 0);
      const y = offset * parseFloat(el.dataset.depth);
      el.dataset.y = y.toFixed(2);
      el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    });
  };
  const requestScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  };
  addEventListener('scroll', requestScroll, { passive: true });
  addEventListener('resize', requestScroll);
  onScroll();

  /* ── Screenshot galleries and the lightbox ──────────── */
  const lb = $('#lb');
  const lbImg = $('#lb-img');
  const lbCap = $('#lb-cap');
  let lbItems = [], lbAt = 0;
  const lbShow = () => {
    const it = lbItems[lbAt];
    lbImg.src = it.src;
    lbImg.alt = it[lang()];
    lbCap.textContent = it[lang()];
  };
  const lbOpen = (items, at) => {
    lbItems = items;
    lbAt = at;
    lb.classList.toggle('single', items.length < 2);
    lbShow();
    lb.showModal();
  };
  const lbStep = d => { lbAt = (lbAt + d + lbItems.length) % lbItems.length; lbShow(); };
  lb.addEventListener('click', e => {
    const b = e.target.closest('[data-lb]');
    if (b) {
      if (b.dataset.lb === 'close') lb.close();
      else lbStep(b.dataset.lb === 'next' ? 1 : -1);
    } else if (e.target === lb || e.target.tagName === 'FIGURE') lb.close();
  });
  lb.addEventListener('keydown', e => {
    if (lbItems.length < 2) return;
    if (e.key === 'ArrowRight') lbStep(1);
    if (e.key === 'ArrowLeft') lbStep(-1);
  });
  const itemOf = el => ({ src: el.dataset.src || el.dataset.zoom, ru: el.dataset.capRu, en: el.dataset.capEn });

  $$('[data-gallery]').forEach(g => {
    const thumbs = $$('.thumb', g);
    const items = thumbs.map(itemOf);
    const shot = $('[data-shot]', g);
    const img = $('img', shot);
    let at = 0;
    thumbs.forEach((t, i) => {
      t.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      t.addEventListener('click', () => {
        if (i === at) return;
        at = i;
        thumbs.forEach((x, j) => {
          x.classList.toggle('is-on', j === i);
          x.setAttribute('aria-pressed', j === i ? 'true' : 'false');
        });
        img.style.opacity = '0';
        const next = new Image();
        next.onload = () => {
          img.src = items[i].src;
          img.alt = items[i][lang()];
          img.style.opacity = '1';
        };
        next.src = items[i].src;
      });
    });
    shot.addEventListener('click', () => lbOpen(items, at));
  });
  const phones = $$('[data-zoom]').reverse();   // the front phone opens first
  const phoneItems = phones.map(itemOf);
  phones.forEach((p, i) => p.addEventListener('click', () => lbOpen(phoneItems, i)));

  /* ── Live GitHub numbers, cached for 10 minutes ─────── */
  const GH = 'https://api.github.com';
  const OWNER = 'iUnreallx';
  const WITH_RELEASES = ['ELM327-Emulator', 'Quanta-Cleaner'];
  const monthYear = iso => {
    const d = new Date(iso);
    return String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  };
  const paint = data => {
    $$('[data-gh]').forEach(el => {
      const [repo, field] = el.dataset.gh.split(':');
      const r = data.repos[repo];
      if (!r) return;
      if (field === 'pushed') el.textContent = monthYear(r.pushed);
      else el.textContent = r[field];
    });
    $$('[data-dl]').forEach(el => {
      const n = data.dl[el.dataset.dl];
      if (n != null) el.textContent = n;
    });
  };
  const json = url => fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(r => r.ok ? r.json() : Promise.reject(r.status));
  const cached = (() => { try { return JSON.parse(store.get('gh-v2') || 'null'); } catch (e) { return null; } })();
  if (cached && cached.data) paint(cached.data);
  if (!cached || Date.now() - cached.t > 6e5) {
    Promise.all([
      json(GH + '/users/' + OWNER + '/repos?per_page=100'),
      Promise.all(WITH_RELEASES.map(n => json(GH + '/repos/' + OWNER + '/' + n + '/releases?per_page=100'))),
    ]).then(([list, rel]) => {
      const repos = {};
      list.forEach(r => { repos[r.name] = { stars: r.stargazers_count, forks: r.forks_count, pushed: r.pushed_at }; });
      const dl = {};
      WITH_RELEASES.forEach((n, i) => {
        dl[n] = rel[i].reduce((s, x) => s + x.assets.reduce((a, b) => a + b.download_count, 0), 0);
      });
      const data = { repos, dl };
      paint(data);
      store.set('gh-v2', JSON.stringify({ t: Date.now(), data }));
    }).catch(() => {});   // the numbers in the HTML stay as a fallback
  }

  /* ── Question and answer with a small model of the emulator ── */
  const hex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase().padStart(2, '0');
  const NOTES = {
    ru: { rpm: 'об/мин', kmh: 'км/ч', pids: 'поддерживаемые PID', reset: 'адаптер сброшен', ok: 'принято', unknown: 'неизвестная команда', none: 'нет данных', load: 'нагрузка', thr: 'дроссель', battery: 'бортсеть', coolant: 'охлаждение' },
    en: { rpm: 'rpm', kmh: 'km/h', pids: 'supported PIDs', reset: 'adapter reset', ok: 'accepted', unknown: 'unknown command', none: 'no data', load: 'load', thr: 'throttle', battery: 'battery', coolant: 'coolant' },
  };
  // The virtual car drifts between idle and highway on its own, so every answer is fresh.
  const car = () => {
    const k = .5 - .5 * Math.cos(performance.now() * .00023);
    return { rpm: 800 + 3400 * k, speed: 118 * k, temp: 84 + 8 * k, load: 18 + 40 * k, thr: 4 + 34 * k, volt: 14.1 - .3 * k };
  };
  const reply = raw => {
    const c = raw.toUpperCase().replace(/\s+/g, '');
    const t = NOTES[lang()], v = car();
    if (c.startsWith('AT')) {
      if (c === 'ATZ') return ['ELM327 v1.5', t.reset];
      if (c === 'ATI') return ['ELM327 v1.5', 'ELM327'];
      if (c === 'ATRV') return [v.volt.toFixed(1) + 'V', t.battery];
      if (/^AT(E[01]|L[01]|S[01]|H[01]|SP[0-9A-C]|D|WS)$/.test(c)) return ['OK', t.ok];
      return ['?', t.unknown];
    }
    if (!/^[0-9A-F]+$/.test(c) || c.length % 2) return ['?', t.unknown];
    if (c.length !== 4 || !c.startsWith('01')) return ['NO DATA', t.none];
    switch (c.slice(2)) {
      case '00': return ['41 00 18 18 80 00', t.pids];
      case '04': return ['41 04 ' + hex(v.load * 2.55), Math.round(v.load) + ' % ' + t.load];
      case '05': return ['41 05 ' + hex(v.temp + 40), Math.round(v.temp) + ' °C'];
      case '0C': { const n = Math.round(v.rpm * 4); return ['41 0C ' + hex(n >> 8) + ' ' + hex(n & 255), Math.round(v.rpm) + ' ' + t.rpm]; }
      case '0D': return ['41 0D ' + hex(v.speed), Math.round(v.speed) + ' ' + t.kmh];
      case '11': return ['41 11 ' + hex(v.thr * 2.55), Math.round(v.thr) + ' % ' + t.thr];
      default: return ['NO DATA', t.none];
    }
  };

  const talk = $('#talk');
  const ask = cmd => {
    const clean = cmd.trim();
    if (!clean) return;
    const [answer, meaning] = reply(clean);
    const li = document.createElement('li');
    li.className = 'q-a';
    [['code', 'q', clean.toUpperCase()], ['code', 'a', answer], ['span', 'm', meaning]].forEach(([tag, cls, text]) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      li.append(el);
    });
    talk.append(li);
    while (talk.children.length > 7) talk.firstChild.remove();
  };

  const POLL = ['010C', '010D', '0105', 'ATRV', '0111'];
  let pollAt = 0, pollTimer = 0, talkVisible = false, pausedUntil = 0, opened = false;
  const pollTick = () => {
    pollTimer = 0;
    if (!talkVisible) return;
    if (performance.now() > pausedUntil) ask(POLL[pollAt++ % POLL.length]);
    pollTimer = setTimeout(pollTick, 1700);
  };
  const openTalk = () => {
    if (opened) return;
    opened = true;
    // The log is full before anyone scrolls to it: an empty box reads as broken.
    ['ATZ', '0100', '010C', '010D', '0105', 'ATRV'].forEach(ask);
  };
  function resetTalk() {
    talk.textContent = '';
    opened = false;
    openTalk();
  }
  const userAsk = cmd => { pausedUntil = performance.now() + 7000; ask(cmd); };
  $$('#talk-keys [data-cmd]').forEach(b => b.addEventListener('click', () => userAsk(b.dataset.cmd)));
  const talkInput = $('#talk-input');
  $('#talk-form').addEventListener('submit', e => {
    e.preventDefault();
    userAsk(talkInput.value);
    talkInput.value = '';
  });
  openTalk();
  if (!reduce && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      talkVisible = e.isIntersecting;
      if (!talkVisible) return;
      if (!pollTimer) pollTimer = setTimeout(pollTick, 1700);
    }, { threshold: .15 }).observe($('.talk'));
  }

  /* ── Goodbye in many languages, on a loop, so there is nothing to miss ── */
  const BYE = ['Adiós', 'Au revoir', 'Ciao', 'Tschüss', 'Tchau', 'Hejdå', 'Hoşça kal', 'さようなら', '안녕히 가세요', 'अलविदा'];
  const byeCanvas = $('#bye');
  const byeStory = () => {
    const en = lang() === 'en';
    const INKS = [[198, 242, 78], [255, 159, 10], [90, 155, 255]];
    return [{ w: en ? 'Bye' : 'Пока', hold: 2800 }, ...[...BYE, en ? 'Пока' : 'Bye'].map((w, i) => ({ w, c: INKS[i % 3], hold: 1100 }))];
  };
  const byeText = new ParticleText(byeCanvas, {
    count: w => (w < 800 ? 2600 : 7000),
    layout: (w, h) => ({ cx: w / 2, cy: h * .44, fs: Math.min(h * .78, w * .24), maxW: w * .92 }),
    ink: () => (root.dataset.theme === 'light' ? [15, 17, 18] : [239, 241, 235]),
  });
  byeText.story = byeStory();
  const byeSize = () => byeText.resize(byeCanvas.clientWidth, byeCanvas.clientHeight);
  byeSize();
  addEventListener('resize', byeSize);
  function byeLang() {
    byeText.setStory(byeStory());
    if (reduce && byeText.current >= 0) byeText.settle(performance.now());
  }
  byeCanvas.parentElement.addEventListener('pointermove', e => {
    const r = byeCanvas.getBoundingClientRect();
    byeText.pointer(e.clientX - r.left, e.clientY - r.top);
  }, { passive: true });
  byeCanvas.parentElement.addEventListener('pointerleave', () => byeText.pointerOff());
  const byeTouch = e => { const t = e.touches[0], r = byeCanvas.getBoundingClientRect(); if (t) byeText.pointer(t.clientX - r.left, t.clientY - r.top); };
  byeCanvas.addEventListener('touchstart', byeTouch, { passive: true });
  byeCanvas.addEventListener('touchmove', byeTouch, { passive: true });
  byeCanvas.addEventListener('touchend', () => byeText.pointerOff(), { passive: true });

  let byeOn = false, byeStarted = false;
  const byeTick = now => {
    if (!byeOn) return;
    byeText.frame(now);
    requestAnimationFrame(byeTick);
  };
  const byeStart = () => {
    if (byeStarted) return;
    byeStarted = true;
    const go = () => {
      if (reduce) { byeText.show(0, 0); byeText.settle(performance.now()); }
      else byeText.play(performance.now(), 0);
    };
    if (document.fonts) document.fonts.load('500 200px "Cormorant Garamond"', 'Пока Bye').catch(() => {}).then(go);
    else go();
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) byeStart();
      const was = byeOn;
      byeOn = e.isIntersecting && !reduce;
      if (byeOn && !was) { byeText.last = 0; requestAnimationFrame(byeTick); }
    }, { threshold: .05 }).observe(byeCanvas);
  } else byeStart();
})();
