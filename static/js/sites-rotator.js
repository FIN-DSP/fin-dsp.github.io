/* ---------- CTPVerse Sites random rotator (bottom of left column) ---------- */
(function () {
  var sites = [
    { name: 'CTPVerse', url: 'https://ctpverse.github.io/', img: '/assets/sites/ctpverse-org-avatar.jpg' },
    { name: 'CTP-EOS', url: 'https://ctp-eos.github.io/', img: '/assets/sites/ctp-eos-triangle-logo.jpg' },
    { name: 'CTP Magazine', url: 'https://ctp-magazine.github.io/', img: '/assets/sites/ctp-magazine-1254x1254.png' },
    { name: 'CTP Music', url: 'https://ctp-music.github.io/', img: '/assets/sites/ctp-music-org-avatar.jpg' },
    { name: 'CTP Space Systems', url: 'https://ctp-space-systems.github.io/', img: '/assets/sites/ctp-space-systems-org-avatar.jpg' },
    { name: 'CTP-PSY', url: 'https://ctp-psy.github.io/', img: '/assets/sites/ctp-psy-org-avatar.jpg' },
    { name: 'CTPETEAMS', url: 'https://ctpeteams.github.io/', img: '/assets/sites/ctpeteams-logo-400.jpg' },
    { name: 'CTPIDM', url: 'https://ctpidm.github.io/', img: '/assets/sites/ctpidm-org-avatar.jpg' }
  ];
  var link = document.getElementById('ctpverse-sites-rotator-link');
  var img = document.getElementById('ctpverse-sites-rotator-img');
  if (!link || !img) return;
  var idx = 0;
  var timer = null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(i) {
    idx = i;
    var s = sites[i];
    img.src = s.img;
    img.alt = s.name;
    link.href = s.url;
    link.title = s.name;
    link.setAttribute('aria-label', s.name);
  }
  function randomNext() {
    if (sites.length < 2) return;
    var n = idx;
    while (n === idx) { n = Math.floor(Math.random() * sites.length); }
    show(n);
  }
  function start() {
    if (timer || reduceMotion) return;
    timer = setInterval(randomNext, 5000);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else { start(); }
  });
  show(0);
  start();
})();
