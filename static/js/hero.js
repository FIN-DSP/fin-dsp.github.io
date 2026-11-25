/* Hero dissolve — true dissolve, as on the CTP-EOS site: the incoming slide
   is placed fully opaque UNDERNEATH the outgoing one, and the outgoing slide
   melts away on top of it over 2.8s. Random order, 11-second interval. */
(function(){
  var viewport = document.querySelector('.hero-viewport');
  if(!viewport) return;
  var slides = [].slice.call(viewport.querySelectorAll('.hero-slide'));
  if(slides.length < 2) return;
  var heroIdx = 0, timer = null;
  var reduceMotion = false;
  try{ reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  function showHero(idx){
    var prevSlide = slides[heroIdx];
    heroIdx = (idx + slides.length) % slides.length;
    var nextSlide = slides[heroIdx];
    slides.forEach(function(s){
      var link = s.querySelector('a');
      if(s === nextSlide){
        s.classList.remove('is-leaving');
        s.classList.add('is-active');
        s.removeAttribute('aria-hidden');
        if(link){ link.removeAttribute('tabindex'); link.style.pointerEvents = 'auto'; }
      } else if(s === prevSlide){
        s.classList.remove('is-active');
        s.classList.add('is-leaving');
        s.setAttribute('aria-hidden','true');
        if(link){ link.setAttribute('tabindex','-1'); link.style.pointerEvents = 'none'; }
        /* Retire the leaving layer once its dissolve ends, so no stale
           slide can sit on top and steal clicks from the held slide. */
        setTimeout(function(){
          if(s.classList.contains('is-leaving') && !s.classList.contains('is-active')){
            s.classList.remove('is-leaving');
          }
        }, 2900);
      } else {
        s.classList.remove('is-active');
        s.classList.remove('is-leaving');
        s.setAttribute('aria-hidden','true');
        if(link){ link.setAttribute('tabindex','-1'); link.style.pointerEvents = 'none'; }
      }
    });
  }
  function randomHero(){
    if(slides.length < 2) return heroIdx;
    var pool = [];
    for(var i=0;i<slides.length;i++){ if(i!==heroIdx) pool.push(i); }
    return pool[Math.floor(Math.random()*pool.length)];
  }
  function nextHero(){
    var target = randomHero();
    var img = slides[target].querySelector('img');
    var done = false;
    function go(){ if(!done){ done=true; showHero(target); } }
    if(img && img.decode){
      var p = null;
      try{ p = img.decode(); }catch(e){}
      if(p && p.then){ p.then(go,go); setTimeout(go,600); } else { go(); }
    } else { go(); }
  }
  function stop(){ if(timer){ clearInterval(timer); timer=null; } }
  function start(){
    stop();
    if(reduceMotion || slides.length < 2) return;
    timer = setInterval(nextHero, 11000);
  }
  document.addEventListener('visibilitychange', function(){ if(document.hidden){ stop(); } else { start(); } });
  start();
})();

/* Featured banner rotator — swipe (slide) */
(function(){
  var track = document.getElementById('featTrack');
  if(!track) return;
  var slides = [].slice.call(track.querySelectorAll('.feat-slide'));
  if(slides.length < 2) return;
  var dotsWrap = document.getElementById('featDots');
  var prevBtn = document.getElementById('featPrev');
  var nextBtn = document.getElementById('featNext');
  var idx = 0, timer = null;
  var reduceMotion = false;
  try{ reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var dots = slides.map(function(_, i){
    var b = document.createElement('button');
    b.className = 'feat-dot' + (i === 0 ? ' is-active' : '');
    b.setAttribute('aria-label', 'Featured ' + (i + 1));
    b.addEventListener('click', function(){ go(i); restart(); });
    dotsWrap.appendChild(b);
    return b;
  });
  function go(i){
    idx = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    dots.forEach(function(d, j){ d.classList.toggle('is-active', j === idx); });
  }
  function next(){ go(idx + 1); }
  function prev(){ go(idx - 1); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }
  function start(){
    stop();
    if(reduceMotion) return;
    timer = setInterval(next, 6000);
  }
  function restart(){ start(); }
  if(prevBtn){ prevBtn.addEventListener('click', function(){ prev(); restart(); }); }
  if(nextBtn){ nextBtn.addEventListener('click', function(){ next(); restart(); }); }
  document.addEventListener('visibilitychange', function(){ if(document.hidden){ stop(); } else { start(); } });
  start();
})();
