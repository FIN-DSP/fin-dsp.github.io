/* FIN-DSP Music Search & Preview — client-side Jamendo API.
   Streams previews from Jamendo's servers; nothing is hosted or
   redistributed by FIN-DSP. Attribution on every card. */
(function () {
  // *** OWNER: paste the Jamendo client ID from developer.jamendo.com ***
  var JAMENDO_CLIENT_ID = 'YOUR-JAMENDO-CLIENT-ID';
  var KEY = 'findsp-jamendo-client-id';
  var input = document.getElementById('jamClientId');
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) { JAMENDO_CLIENT_ID = saved; input.value = saved; }
  document.getElementById('jamSaveId').addEventListener('click', function () {
    var v = (input.value || '').trim();
    if (!v) return;
    JAMENDO_CLIENT_ID = v;
    try { localStorage.setItem(KEY, v); } catch (e) {}
    document.getElementById('jamIdSaved').textContent = 'Saved.';
  });

  var searchEl = document.getElementById('jamSearch');
  var noteEl = document.getElementById('jamNote');
  var resEl = document.getElementById('jamResults');
  var moreBtn = document.getElementById('jamMore');
  var all = [];
  var shown = 0;
  var PAGE = 10;

  function render() {
    var slice = all.slice(0, shown);
    resEl.innerHTML = '';
    slice.forEach(function (t) {
      var card = document.createElement('article');
      card.className = 'article-card';
      var meta = document.createElement('div');
      meta.className = 'a-meta';
      meta.textContent = [t.artist_name, t.album_name].filter(Boolean).join(' · ');
      card.appendChild(meta);
      if (t.album_image) {
        var th = document.createElement('span');
        th.className = 'a-thumb';
        var ti = document.createElement('img');
        ti.src = t.album_image; ti.alt = t.name || ''; ti.loading = 'lazy';
        th.appendChild(ti);
        card.appendChild(th);
      }
      var h = document.createElement('h3');
      h.textContent = t.name || 'Untitled track';
      card.appendChild(h);
      if (t.license_ccurl) {
        var lic = document.createElement('p');
        var la = document.createElement('a');
        la.href = t.license_ccurl; la.target = '_blank'; la.rel = 'noopener';
        la.textContent = 'Licence: ' + t.license_ccurl;
        lic.appendChild(la);
        card.appendChild(lic);
      }
      if (t.audio) {
        var au = document.createElement('audio');
        au.controls = true; au.preload = 'none'; au.src = t.audio;
        au.style.width = '100%';
        card.appendChild(au);
      }
      if (t.shareurl) {
        var more = document.createElement('a');
        more.className = 'a-more';
        more.href = t.shareurl; more.target = '_blank'; more.rel = 'noopener';
        more.textContent = 'Open on Jamendo';
        card.appendChild(more);
      }
      resEl.appendChild(card);
    });
    moreBtn.style.display = all.length > shown ? '' : 'none';
  }
  function doSearch() {
    var q = (searchEl.value || '').trim();
    if (!q) { noteEl.textContent = 'Enter a search above to find tracks.'; return; }
    if (!JAMENDO_CLIENT_ID || JAMENDO_CLIENT_ID === 'YOUR-JAMENDO-CLIENT-ID') {
      noteEl.textContent = 'No Jamendo client ID saved yet — add one in the Setup section below.';
      return;
    }
    noteEl.textContent = 'Searching…';
    var url = 'https://api.jamendo.com/v3.0/tracks/?client_id=' + encodeURIComponent(JAMENDO_CLIENT_ID)
      + '&format=json&limit=20&search=' + encodeURIComponent(q) + '&include=licenses';
    fetch(url)
      .then(function (r) { if (!r.ok) throw new Error('jamendo'); return r.json(); })
      .then(function (data) {
        all = (data && data.results) || [];
        shown = PAGE;
        noteEl.textContent = all.length ? ('Found ' + all.length + ' track' + (all.length === 1 ? '' : 's') + ' for "' + q + '".') : ('No tracks found for "' + q + '".');
        render();
      })
      .catch(function () {
        noteEl.textContent = 'Search failed — check the client ID and your connection, then try again.';
      });
  }
  document.getElementById('jamGo').addEventListener('click', doSearch);
  searchEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });
  moreBtn.addEventListener('click', function () { shown += PAGE; render(); });
})();
