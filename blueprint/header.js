// Show the header once the hero is fully scrolled out of view; hide it again when the hero returns.
(() => {
  const bar = document.querySelector('.bar-nav.over');
  const hero = document.querySelector('.hero');
  if (!bar || !hero) return;
  new IntersectionObserver(([e]) => bar.classList.toggle('show', !e.isIntersecting)).observe(hero);
})();
