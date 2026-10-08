// Endless project rail. The cards are cloned once before and once after the real set; whenever the
// scroller drifts into a clone set it is shifted back by exactly one set width, so the jump is invisible.
// Snap and touch drag still come from native scrolling.
document.querySelectorAll('.rail-band').forEach(band => {
  const wrap = band.querySelector('.rail-wrap');
  const rail = band.querySelector('.rail');
  const prev = band.querySelector('[data-rail="prev"]');
  const next = band.querySelector('[data-rail="next"]');
  if (!wrap || !rail) return;

  const originals = [...rail.children];
  if (originals.length < 2) return;
  const cloneSet = () => originals.map(li => {
    const c = li.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.inert = true;
    return c;
  });
  const before = cloneSet(), after = cloneSet();
  rail.prepend(...before);
  rail.append(...after);

  const setWidth = () => after[0].offsetLeft - originals[0].offsetLeft;
  const home = () => originals[0].offsetLeft - before[0].offsetLeft;

  const jump = left => {
    wrap.style.scrollSnapType = 'none';
    wrap.scrollLeft = left;
    requestAnimationFrame(() => { wrap.style.scrollSnapType = ''; });
  };
  const recentre = () => {
    const w = setWidth(), x = wrap.scrollLeft, h = home();
    if (x < h - w / 2) jump(x + w);
    else if (x > h + w / 2) jump(x - w);
  };

  jump(home());
  let t;
  wrap.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(recentre, 140); }, { passive: true });
  addEventListener('resize', () => jump(home()));

  const step = () => originals[0].getBoundingClientRect().width + 16;
  const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  prev && prev.addEventListener('click', () => wrap.scrollBy({ left: -step(), behavior: smooth }));
  next && next.addEventListener('click', () => wrap.scrollBy({ left: step(), behavior: smooth }));
});
