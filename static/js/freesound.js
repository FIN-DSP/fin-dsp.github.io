/* Freesound Search & Preview — client-side Freesound APIv2.
   Preview-only: streams preview audio from Freesound's servers,
   never the original file, never a download, never module files. */
(function () {
  // *** OWNER: paste the Freesound API key from freesound.org/apiv2/apply/ ***
  var FREESOUND_API_KEY = 'YOUR-FREESOUND-API-KEY';
  var KEY = 'findsp-freesound-key';
  var input = document.getElementById('fsKey');
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) { FREESOUND_API_KEY = saved; input.value = saved; }
  document.getElementById('fsSaveKey').addEventListener('click', function () {
    var v = (input.value || '').trim();
    if (!v) return;
    FREESOUND_API_KEY = v;
    try { localStorage.setItem(KEY, v); } catch (e) {}
    document.getElementById('fsKeySaved').textContent = 'Saved.';
  });

  var searchEl = document.getElementById('fsSearch');
  var noteEl = document.getElementById('fsNote');
  var resEl = document.getElementById('fsResults');
  var moreBtn = document.getElementById('fsMore');
  var all = [];
  var shown = 0;
  var PAGE = 10;

  function render() {
    var slice = all.slice(0, shown);
    resEl.innerHTML = '';
    slice.forEach(function (snd) {
      var card = document.createElement('article');
      card.className = 'article-card';
      var meta = document.createElement('div');
      meta.className = 'a-meta';
      meta.textContent = ['by ' + (snd.username || 'unknown'), snd.license || ''].filter(Boolean).join(' · ');
      card.appendChild(meta);
      var h = document.createElement('h3');
      h.textContent = snd.name || 'Untitled sound';
      card.appendChild(h);
      var prev = snd.previews && (snd.previews['preview-hq-mp3'] || snd.previews['preview-lq-mp3']);
      if (prev) {
        var au = document.createElement('audio');
        au.controls = true; au.preload = 'none'; au.src = prev;
        au.style.width = '100%';
        card.appendChild(au);
        var pn = document.createElement('p');
        pn.className = 'art-note';
        pn.textContent = 'Preview only — the original file is not offered here.';
        card.appendChild(pn);
      }
      if (snd.url) {
        var more = document.createElement('a');
        more.className = 'a-more';
        more.href = snd.url; more.target = '_blank'; more.rel = 'noopener';
        more.textContent = 'Open on Freesound';
        card.appendChild(more);
      }
      resEl.appendChild(card);
    });
    moreBtn.style.display = all.length > shown ? '' : 'none';
  }
  function doSearch() {
    var q = (searchEl.value || '').trim();
    if (!q) { noteEl.textContent = 'Enter a search above to find sounds.'; return; }
    if (!FREESOUND_API_KEY || FREESOUND_API_KEY === 'YOUR-FREESOUND-API-KEY') {
      noteEl.textContent = 'No Freesound API key saved yet — add one in the Setup section below.';
      return;
    }
    noteEl.textContent = 'Searching…';
    var url = 'https://freesound.org/apiv2/search/text/?query=' + encodeURIComponent(q)
      + '&token=' + encodeURIComponent(FREESOUND_API_KEY)
      + '&fields=id,name,username,license,previews,url&page_size=20';
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('freesound'); return r.json(); })
      .then(function (data) {
        all = (data && data.results) || [];
        shown = PAGE;
        noteEl.textContent = all.length ? ('Found ' + all.length + ' sound' + (all.length === 1 ? '' : 's') + ' for "' + q + '".') : ('No sounds found for "' + q + '".');
        render();
      })
      .catch(function () {
        noteEl.textContent = 'Search failed — check the API key and your connection, then try again.';
      });
  }
  document.getElementById('fsGo').addEventListener('click', doSearch);
  searchEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
  moreBtn.addEventListener('click', function () { shown += PAGE; render(); });
})();
