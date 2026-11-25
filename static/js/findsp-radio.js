/* FIN-DSP Radio — laut.fm station switcher, same pattern as the
   CTP Magazine player (mp* ids/CSS/JS). Click-to-play, no autoplay.
   All 32 stations verified live (stream + now-playing API) 2026-11-19. */
(function () {
  var STATIONS = [
    { id: 'aphex-twin-radio', name: 'Aphex Twin Radio', genre: 'IDM / Ambient Techno / Drill \'n\' Bass' },
    { id: 'anechoic_chamber_music', name: 'Anechoic Chamber Music', genre: 'Ambient / Electronica / Drone / Experimental' },
    { id: 'experimentalgems', name: 'Experimental Gems', genre: 'Experimental / Electronic / Drone' },
    { id: 'fraktal-phere', name: 'Fraktal Phere', genre: 'Ambient / Experimental' },
    { id: 'nomoon', name: 'Nomoon', genre: 'Electronic / Ambient / Noise / Field Recordings' },
    { id: 'radiodopesoundzfm', name: 'Radiodopesoundz FM', genre: 'Electro / Breakcore / Experimental' },
    { id: 'bunker-radio', name: 'Bunker Radio', genre: 'Electro / Experimental / Industrial' },
    { id: 'fm303', name: 'FM 303', genre: 'Industrial / Synth-Pop / Techno / Acid' },
    { id: 'netlabel_org', name: 'Netlabel Org', genre: 'Ambient / Dub / Techno / Electro / Electronica' },
    { id: 'sem', name: 'Sem', genre: 'Experimental / Electronic' },
    { id: 'ad_infinitum', name: 'Ad Infinitum', genre: 'Experimental / Electronic / Avantgarde' },
    { id: 'experimental', name: 'Experimental', genre: 'Experimental' },
    { id: 'technoszene', name: 'Technoszene', genre: 'Techno / Electro / EBM' },
    { id: 'technothorium', name: 'Technothorium', genre: 'Techno / Dark Techno / Industrial' },
    { id: 'radiodarksouls', name: 'Radiodarksouls', genre: 'Dark Electro / Industrial / Darkwave' },
    { id: 'darkclubradio', name: 'Darkclub Radio', genre: 'Industrial / EBM / Darkwave' },
    { id: 'htd-radio', name: 'HTD Radio', genre: 'Darkwave / EBM / Industrial' },
    { id: 'radio-body-music', name: 'Radio Body Music', genre: 'EBM / Dark Electro' },
    { id: 'ebm', name: 'EBM', genre: 'EBM / Industrial / Darkwave' },
    { id: 'darksoundradio', name: 'Darksound Radio', genre: 'EBM / Hellectro / Industrial' },
    { id: 'digital_gunfire', name: 'Digital Gunfire', genre: 'EBM / Industrial' },
    { id: 'klangwelt', name: 'Klangwelt', genre: 'EBM / Industrial / New Wave' },
    { id: 'darkzeroradio', name: 'Dark Zero Radio', genre: 'Darkwave / EBM / Industrial' },
    { id: 'boy-harsher-radio', name: 'Boy Harsher Radio', genre: 'Darkwave / Minimal Wave / EBM' },
    { id: 'nonpop', name: 'Nonpop', genre: 'Industrial / Avantgarde / Noise' },
    { id: 'greyarea', name: 'Greyarea', genre: 'Industrial / Ritual / Dark Ambient / EBM' },
    { id: '_a_u_r_a_t_o_n_', name: 'AURATON', genre: 'Ambient / Experimental / Industrial / Noise' },
    { id: 'bleakradio', name: 'Bleak Radio', genre: 'Industrial / Avantgarde / Post-Punk' },
    { id: 'booomb', name: 'Booomb', genre: 'Dark Electro / Industrial / Aggrotech' },
    { id: 'schwarzer_kanal', name: 'Schwarzer Kanal', genre: 'EBM / Industrial / Darkwave' },
    { id: 'pitchblackradio', name: 'Pitchblack Radio', genre: 'EBM / Industrial / Post-Punk' },
    { id: 'nachtflug', name: 'Nachtflug', genre: 'Darkwave / EBM / Industrial' }
  ];
  var audio = document.getElementById('mpAudio');
  if (!audio) return;
  var playBtn = document.getElementById('mpPlayBtn');
  var playIcon = document.getElementById('mpPlayIcon');
  var ICON_PLAY = '<path d="M7 4.5v15l13-7.5z"/>';
  var ICON_PAUSE = '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
  var metaTimer = null;
  var idx = 0;
  var started = false;

  function station() { return STATIONS[idx]; }
  function streamURL() { return 'https://stream.laut.fm/' + station().id; }
  function setState(txt) { document.getElementById('mpState').textContent = txt; }
  function setStatus(txt) { document.getElementById('mpStatus').textContent = txt; }
  function setPlayingUI(isPlaying) {
    document.getElementById('mpEq').classList.toggle('playing', isPlaying);
    playIcon.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
  }
  function renderStation() {
    document.getElementById('mpChannel').textContent = station().name;
    document.getElementById('mpGenre').textContent = station().genre + ' · laut.fm';
    document.getElementById('mpSource').textContent = 'stream.laut.fm/' + station().id;
    renderList();
  }
  function renderList() {
    var list = document.getElementById('mpList');
    if (!list) return;
    if (!list.children.length) {
      STATIONS.forEach(function (st, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-i', String(i));
        var nm = document.createElement('span');
        nm.textContent = st.name;
        var g = document.createElement('span');
        g.className = 'g';
        g.textContent = ' — ' + st.genre;
        b.appendChild(nm); b.appendChild(g);
        b.addEventListener('click', function () { switchTo(i); });
        list.appendChild(b);
      });
    }
    for (var k = 0; k < list.children.length; k++) {
      list.children[k].classList.toggle('is-active', k === idx);
    }
    var active = list.children[idx];
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
  }
  function fetchMeta() {
    fetch('https://api.laut.fm/station/' + station().id + '/current_song')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (song) {
        if (!song) return;
        var artist = (song.artist && song.artist.name) ? song.artist.name : '';
        var title = song.title || '';
        if (!artist && !title) return;
        var track = document.getElementById('mpTrack');
        track.innerHTML = '';
        var lab = document.createElement('div');
        lab.className = 'mp-label'; lab.textContent = 'On air now';
        var t = document.createElement('div');
        var strong = document.createElement('span'); strong.className = 't';
        strong.textContent = artist ? (artist + ' — ' + title) : title;
        t.appendChild(strong);
        track.appendChild(lab); track.appendChild(t);
      })
      .catch(function () { /* metadata is a bonus; the stream itself keeps playing */ });
  }
  function startMeta() {
    fetchMeta();
    if (metaTimer) clearInterval(metaTimer);
    metaTimer = setInterval(fetchMeta, 45000);
  }
  function stopMeta() { if (metaTimer) { clearInterval(metaTimer); metaTimer = null; } }
  function loadAndPlay() {
    audio.src = streamURL();
    started = true;
    audio.play().catch(function () { setStatus('Press play to listen'); });
    startMeta();
  }
  function switchTo(i) {
    idx = (i + STATIONS.length) % STATIONS.length;
    renderStation();
    if (started && !audio.paused) {
      loadAndPlay();
      setStatus('Switching station…');
    } else if (started) {
      audio.removeAttribute('src'); audio.load(); started = false;
      setPlayingUI(false); setState('Ready'); setStatus('Stream loaded — press play');
      document.getElementById('mpTrack').innerHTML = '<span style="color:var(--muted);">Press play — live radio, no playlist, no skip.</span>';
      stopMeta();
    }
  }
  document.getElementById('mpPrev').addEventListener('click', function () { switchTo(idx - 1); });
  document.getElementById('mpNext').addEventListener('click', function () { switchTo(idx + 1); });
  playBtn.addEventListener('click', function () {
    if (audio.paused) {
      if (!started) { loadAndPlay(); } else { audio.play().catch(function () { setStatus('Press play to listen'); }); startMeta(); }
      setPlayingUI(true); setState('Playing'); setStatus('Live — ' + station().name);
    } else {
      audio.pause(); setPlayingUI(false); setState('Paused'); setStatus('Paused — press play to resume');
    }
  });
  document.getElementById('mpStopBtn').addEventListener('click', function () {
    audio.pause(); audio.removeAttribute('src'); audio.load(); started = false;
    setPlayingUI(false); setState('Ready'); setStatus('Stopped — press play');
    document.getElementById('mpTrack').innerHTML = '<span style="color:var(--muted);">Press play — live radio, no playlist, no skip.</span>';
    stopMeta();
  });
  var vol = document.getElementById('mpVol');
  audio.volume = vol.value / 100;
  vol.addEventListener('input', function () { audio.volume = vol.value / 100; });
  audio.addEventListener('playing', function () { setPlayingUI(true); setState('Playing'); setStatus('Live — ' + station().name); });
  audio.addEventListener('pause', function () { if (started) { setPlayingUI(false); setState('Paused'); } });
  audio.addEventListener('error', function () { setStatus('Stream error — try another station'); setPlayingUI(false); setState('Error'); });
  renderList();
})();
