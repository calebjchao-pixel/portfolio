const lb=document.getElementById('lb'),im=lb.querySelector('img');
document.querySelectorAll('[data-lb]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();im.src=a.href;lb.hidden=false}));
lb.addEventListener('click',()=>lb.hidden=true);
addEventListener('keydown',e=>{if(e.key==='Escape')lb.hidden=true});
