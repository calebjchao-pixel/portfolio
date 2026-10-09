// Standard photo carousel: one photo at a time, previous/next arrows, dots, swipe (native
// scroll-snap) and arrow keys when focused. The arrows wrap from the last photo to the first.
// Without JS the track still swipes/scrolls; the arrows and dots only appear once this runs.
document.querySelectorAll('.car').forEach(car => {
  const track = car.querySelector('.car-track');
  const slides = [...track.children];
  const dotsBox = car.querySelector('.car-dots');
  if (!slides.length) return;
  car.classList.add('car-js');

  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const index = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
  const go = i => {
    i = (i + slides.length) % slides.length;
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth() });
  };

  const dots = slides.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'car-dot';
    b.setAttribute('aria-label', `Show photo ${i + 1} of ${slides.length}`);
    b.addEventListener('click', () => go(i));
    dotsBox.append(b);
    return b;
  });

  const sync = () => {
    const i = index();
    dots.forEach((d, n) => d.toggleAttribute('aria-current', n === i));
  };

  car.querySelector('.car-prev').addEventListener('click', () => go(index() - 1));
  car.querySelector('.car-next').addEventListener('click', () => go(index() + 1));
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index() - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index() + 1); }
  });
  track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  // keep the current photo in place when the window is resized
  let held = 0;
  new ResizeObserver(() => { track.scrollLeft = held * track.clientWidth; }).observe(track);
  track.addEventListener('scrollend', () => { held = index(); });
  track.addEventListener('scroll', () => { held = index(); }, { passive: true });
  sync();
});
