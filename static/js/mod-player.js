/* Mod Player — drag-and-drop tracker module playback.
   Player code vendored from electronoora/webaudio-mod-player (MIT).
   Files play locally in the browser; nothing is uploaded and no
   module files are hosted by FIN-DSP. */
(function () {
  var mod = new Modplayer();
  mod.setautostart(true);
  var statusEl = document.getElementById('modStatus');
  var titleEl = document.getElementById('modTitle');
  var infoEl = document.getElementById('modInfo');
  var posEl = document.getElementById('modPos');
  var vuEl = document.getElementById('modVu');
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('modFile');
  var vuTimer = null;

  function setStatus(t) { statusEl.textContent = t; }
  mod.onReady = function () {
    titleEl.textContent = mod.title || '(untitled module)';
    infoEl.textContent = 'Format: ' + (mod.format || '—').toUpperCase()
      + ' · Channels: ' + (mod.channels || '—')
      + ' · Patterns: ' + (mod.patterns || '—')
      + ' · Length: ' + (mod.songlen || '—') + ' positions';
    setStatus('Ready — playing.');
    startVu();
  };
  mod.onPlay = function () { setStatus('Playing.'); startVu(); };
  mod.onStop = function () { setStatus('Stopped.'); stopVu(); };

  function startVu() {
    if (vuTimer) return;
    vuTimer = setInterval(function () {
      if (!mod.playing) return;
      var txt = 'Position: ' + (mod.position || 0) + '/' + (mod.songlen || 0)
        + ' · Row: ' + (mod.row || 0)
        + ' · Pattern: ' + (mod.currentpattern ? mod.currentpattern() : '—');
      posEl.textContent = txt;
      if (mod.chvu && mod.channels) {
        var bars = '';
        for (var c = 0; c < mod.channels; c++) {
          var v = Math.min(1, Math.max(0, mod.chvu[c] || 0));
          bars += '<span style="flex:1; background:var(--line); height:' + Math.max(2, Math.round(v * 26)) + 'px; display:block;"></span>';
        }
        vuEl.innerHTML = bars;
      }
    }, 250);
  }
  function stopVu() { if (vuTimer) { clearInterval(vuTimer); vuTimer = null; } }

  /* Load a local file — mirrors Modplayer.load() but parses from an
     ArrayBuffer instead of fetching a URL (blob URLs carry no
     extension, so load() cannot identify the format from them). */
  function loadLocal(file) {
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['mod', 's3m', 'xm'].indexOf(ext) === -1) {
      setStatus('Unsupported file — use .mod, .s3m or .xm.');
      return;
    }
    setStatus('Loading ' + file.name + '…');
    var reader = new FileReader();
    reader.onload = function () {
      var buffer = new Uint8Array(reader.result);
      var player = null;
      if (ext === 'mod') player = new Protracker();
      else if (ext === 's3m') player = new Screamtracker();
      else player = new Fasttracker();
      mod.format = ext;
      mod.player = player;
      if (!player.parse(buffer)) {
        setStatus('Could not parse ' + file.name + ' — not a valid ' + ext.toUpperCase() + ' file.');
        return;
      }
      mod.title = player.title;
      mod.signature = player.signature;
      mod.songlen = player.songlen;
      mod.channels = player.channels;
      mod.patterns = player.patterns;
      mod.filter = player.filter;
      if (mod.context) mod.setfilter(mod.filter);
      mod.mixval = player.mixval;
      mod.samplenames = new Array(32);
      for (var i = 0; i < 32; i++) mod.samplenames[i] = '';
      if (mod.format === 'xm' || mod.format === 'it') {
        for (var j = 0; j < player.instrument.length; j++) mod.samplenames[j] = player.instrument[j].name;
      } else {
        for (var k = 0; k < player.sample.length; k++) mod.samplenames[k] = player.sample[k].name;
      }
      mod.state = 'ready.';
      mod.loading = false;
      mod.onReady();
      if (mod.autostart) mod.play();
    };
    reader.onerror = function () { setStatus('Could not read ' + file.name + '.'); };
    reader.readAsArrayBuffer(file);
  }

  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.style.borderColor = 'var(--link-hover)'; });
  dropZone.addEventListener('dragleave', function () { dropZone.style.borderColor = ''; });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.style.borderColor = '';
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadLocal(f);
  });
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) loadLocal(fileInput.files[0]);
  });
  document.getElementById('modPlay').addEventListener('click', function () { mod.play(); });
  document.getElementById('modPause').addEventListener('click', function () { mod.pause(); });
  document.getElementById('modStop').addEventListener('click', function () { mod.stop(); });
  document.getElementById('modRepeat').addEventListener('change', function (e) { mod.setrepeat(e.target.checked); });
})();
