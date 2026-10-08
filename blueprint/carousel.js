// Arrow buttons drive the native scroller; snap + drag still work without JS.
document.querySelectorAll('.rail-band').forEach(band => {
  const wrap = band.querySelector('.rail-wrap');
  const prev = band.querySelector('[data-rail="prev"]');
  const next = band.querySelector('[data-rail="next"]');
  if (!wrap || !prev || !next) return;
  const step = () => {
    const item = wrap.querySelector('.rail > li');
    return item ? item.getBoundingClientRect().width + 16 : wrap.clientWidth * 0.8;
  };
  const sync = () => {
    const max = wrap.scrollWidth - wrap.clientWidth - 1;
    prev.disabled = wrap.scrollLeft <= 1;
    next.disabled = wrap.scrollLeft >= max;
  };
  const go = dir => wrap.scrollBy({ left: dir * step(), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  wrap.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
});
