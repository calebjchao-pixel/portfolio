// The three photos around the headshot fly in from their own sides the first time the headshot is fully on screen.
// The hidden start state only exists once this script adds .about-anim, so without JS (or with reduced motion) they simply show.
(() => {
  const photo = document.querySelector('.about-photo');
  const collage = document.querySelector('.about-collage');
  if (!photo || !collage || !('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  collage.classList.add('about-anim');
  const play = () => collage.classList.add('in');
  let io;
  const watch = () => {
    if (io) io.disconnect();
    // "fully on screen": the whole headshot, or as much of it as the window can hold on short screens
    const h = photo.getBoundingClientRect().height || 1;
    const t = Math.min(1, (innerHeight * 0.98) / h);
    io = new IntersectionObserver(([e]) => { if (e.intersectionRatio >= t - 0.01) { play(); io.disconnect(); } }, { threshold: [t] });
    io.observe(photo);
  };
  watch();
  addEventListener('resize', () => { if (!collage.classList.contains('in')) watch(); });
})();
