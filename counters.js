// The big numbers count up once, when they come into view.
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const run = el => {
    let target = parseInt(el.textContent, 10), wrote = el.textContent, t0 = 0;
    if (!target) return;
    const step = now => {
      // Fresh numbers from GitHub may land while it counts: they become the new goal.
      if (el.textContent !== wrote) target = parseInt(el.textContent, 10) || target;
      t0 = t0 || now;
      const p = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - p, 4);
      wrote = el.textContent = String(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { io.unobserve(e.target); run(e.target); }
  }), { threshold: .6 });
  document.querySelectorAll('.spec dd.big').forEach(el => io.observe(el));
})();
