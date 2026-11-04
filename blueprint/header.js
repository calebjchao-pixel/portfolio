// Home header: the bar (page links) slides down a moment after the hero animation finishes;
// the logo in it only slides down once the hero has scrolled out of view, and back up when it returns.
(() => {
  const bar = document.querySelector('.bar-nav.over');
  const hero = document.querySelector('.hero');
  if (!bar || !hero) return;
  const show = () => bar.classList.add('show');

  // wait for the "UAV Pilot" slide (the last part of the hero animation); with no animation, show now
  const last = document.querySelector('.role span');
  const anims = last && last.getAnimations ? last.getAnimations() : [];
  if (anims.length) anims[0].finished.then(() => setTimeout(show, 500), show);
  else show();

  new IntersectionObserver(([e]) => {
    bar.classList.toggle('logo-in', !e.isIntersecting);
    if (!e.isIntersecting) show();   // scrolling away early brings the whole header in at once
  }).observe(hero);
})();
