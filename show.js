const imgs=[...document.querySelectorAll('.show img')],dots=[...document.querySelectorAll('.show .dots button')];
let cur=0,timer;
const go=n=>{imgs[cur].classList.remove('on');dots[cur].classList.remove('on');cur=(n+imgs.length)%imgs.length;imgs[cur].classList.add('on');dots[cur].classList.add('on')};
const start=()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)timer=setInterval(()=>go(cur+1),5000)};
dots.forEach((d,n)=>d.addEventListener('click',()=>{clearInterval(timer);go(n);start()}));
imgs.forEach(i=>i.loading='eager');start();
