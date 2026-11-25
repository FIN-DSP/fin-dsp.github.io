/* Latest Projects — reads projects.json at runtime, renders cards newest
   first, 40 at a time, with a name search over the loaded cards. */
(function () {
  var PAGE = 40;
  var listEl = document.getElementById('projectList');
  var moreBtn = document.getElementById('projMore');
  var searchEl = document.getElementById('projSearch');
  var countEl = document.getElementById('statusProjectCount');
  var catMenu = document.getElementById('catMenu');
  var tagCloud = document.getElementById('tagCloud');
  var catLine = document.getElementById('projCatLine');
  var all = [];
  var shown = 0;
  /* Active category filter ('' = all categories). Each project carries
     a `category`, so a category returns exactly its own projects. */
  var activeCategory = '';
  var activeOrigin = '';

  function field(a, names) {
    for (var i = 0; i < names.length; i++) {
      if (a[names[i]]) return a[names[i]];
    }
    return '';
  }
  function filtered() {
    var items = all;
    if (activeCategory) {
      items = items.filter(function (a) {
        return field(a, ['category']) === activeCategory;
      });
    }
    if (activeOrigin) {
      items = items.filter(function (a) {
        return field(a, ['origin']) === activeOrigin;
      });
    }
    var q = (searchEl.value || '').toLowerCase().trim();
    if (q) {
      items = items.filter(function (a) {
        return String(field(a, ['name', 'title'])).toLowerCase().indexOf(q) > -1;
      });
    }
    return items;
  }
  function render() {
    var items = filtered();
    var slice = items.slice(0, shown);
    listEl.innerHTML = '';
    if (catLine) {
      var scope = activeOrigin ? ' (' + activeOrigin + ' only)' : '';
      catLine.textContent = activeCategory
        ? 'Showing ' + activeCategory + ' — ' + items.length + ' project' + (items.length === 1 ? '' : 's') + scope
        : 'Showing all categories — ' + items.length + ' projects' + scope;
    }
    if (!items.length) {
      var p = document.createElement('p');
      p.className = 'art-note';
      p.textContent = all.length
        ? (activeCategory ? 'No projects in ' + activeCategory + ' yet — check back soon.' : 'No projects match that search.')
        : 'No projects yet — check back soon.';
      listEl.appendChild(p);
    }
    slice.forEach(function (a) {
      var url = field(a, ['url', 'link']);
      var card = document.createElement('article');
      card.className = 'article-card';
      var meta = document.createElement('div');
      meta.className = 'a-meta';
      var src = field(a, ['source', 'repo']);
      var cat = field(a, ['category']);
      var origin = field(a, ['origin']);
      var date = field(a, ['date', 'published', 'pubDate', 'updated']);
      var dateTxt = '';
      if (date) {
        var d = new Date(date);
        dateTxt = isNaN(d.getTime()) ? String(date) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      }
      if (origin) {
        var badge = document.createElement('span');
        badge.className = 'proj-badge' + (origin === 'FIN-DSP' ? ' own' : '');
        badge.textContent = origin;
        meta.appendChild(badge);
        meta.appendChild(document.createTextNode('  '));
      }
      var metaTxt = document.createElement('span');
      metaTxt.textContent = [cat, src, dateTxt].filter(Boolean).join(' · ');
      meta.appendChild(metaTxt);
      card.appendChild(meta);
      /* Showcase image — only when the project carries one (its own
         screenshot, credited). Text-only otherwise. */
      var img = field(a, ['image']);
      if (img && url) {
        var ilink = document.createElement('a');
        ilink.className = 'a-thumb';
        ilink.href = url; ilink.target = '_blank'; ilink.rel = 'noopener';
        var iimg = document.createElement('img');
        iimg.src = img; iimg.alt = field(a, ['name', 'title']) || '';
        iimg.loading = 'lazy';
        var icred = field(a, ['image_credit']);
        if (icred) iimg.title = 'Screenshot: ' + icred;
        iimg.onerror = function(){ ilink.style.display = 'none'; };
        ilink.appendChild(iimg);
        card.appendChild(ilink);
      }
      var h = document.createElement('h3');
      if (url) {
        var link = document.createElement('a');
        link.href = url; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = field(a, ['name', 'title']) || url;
        h.appendChild(link);
      } else {
        h.textContent = field(a, ['name', 'title']);
      }
      card.appendChild(h);
      var ex = field(a, ['description', 'excerpt', 'summary']);
      if (ex) {
        String(ex).split(/\n\n+/).forEach(function (para) {
          para = para.trim();
          if (!para) return;
          var p = document.createElement('p');
          p.textContent = para;
          card.appendChild(p);
        });
      }
      if (url) {
        var more = document.createElement('a');
        more.className = 'a-more';
        more.href = url; more.target = '_blank'; more.rel = 'noopener';
        more.textContent = 'View the project';
        card.appendChild(more);
      }
      listEl.appendChild(card);
    });
    moreBtn.style.display = items.length > shown ? '' : 'none';
  }
  moreBtn.addEventListener('click', function () { shown += PAGE; render(); });
  searchEl.addEventListener('input', function () { clearSearchTagHighlight(); shown = PAGE; render(); });
  /* Category filter — clicking a category shows only that category's
     projects (from the already-loaded projects.json; no new fetch). */
  function syncCatHighlight() {
    var menus = [catMenu, tagCloud];
    for (var m = 0; m < menus.length; m++) {
      if (!menus[m]) continue;
      var links = menus[m].querySelectorAll('a[data-category]');
      for (var i = 0; i < links.length; i++) {
        links[i].classList.toggle('is-active', (links[i].getAttribute('data-category') || '') === activeCategory);
      }
    }
  }
  function clearSearchTagHighlight() {
    if (!tagCloud) return;
    var links = tagCloud.querySelectorAll('a[data-search]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.remove('is-active');
    }
  }
  if (catMenu) {
    catMenu.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[data-category]') : null;
      if (!a) return;
      activeCategory = a.getAttribute('data-category') || '';
      syncCatHighlight();
      clearSearchTagHighlight();
      shown = PAGE;
      render();
    });
  }
  /* Tags cloud — a category tag works exactly like the Categories menu; a
     keyword tag puts that word in the name search box and filters by it. */
  if (tagCloud) {
    tagCloud.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a') : null;
      if (!a) return;
      if (a.hasAttribute('data-category')) {
        activeCategory = a.getAttribute('data-category') || '';
        syncCatHighlight();
        clearSearchTagHighlight();
      } else if (a.hasAttribute('data-search')) {
        activeCategory = '';
        searchEl.value = a.getAttribute('data-search') || '';
        syncCatHighlight();
        clearSearchTagHighlight();
        a.classList.add('is-active');
      } else {
        return;
      }
      shown = PAGE;
      render();
    });
  }

  /* Origin filter — FIN-DSP's own projects vs community discoveries. */
  var originLine = document.getElementById('projOriginLine');
  if (originLine) {
    originLine.addEventListener('click', function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[data-origin]') : null;
      if (!a) return;
      ev.preventDefault();
      activeOrigin = a.getAttribute('data-origin') || '';
      var links = originLine.querySelectorAll('a[data-origin]');
      for (var i = 0; i < links.length; i++) {
        links[i].classList.toggle('is-active', links[i] === a);
      }
      shown = PAGE;
      render();
    });
  }

  fetch('projects.json')
    .then(function (r) { if (!r.ok) throw new Error('projects'); return r.json(); })
    .then(function (data) {
      var arr = Array.isArray(data) ? data : (data.projects || data.items || []);
      all = arr.slice().sort(function (a, b) {
        var da = new Date(field(a, ['date', 'published', 'pubDate', 'updated']) || 0).getTime() || 0;
        var db = new Date(field(b, ['date', 'published', 'pubDate', 'updated']) || 0).getTime() || 0;
        return db - da;
      });
      shown = PAGE;
      if (countEl) countEl.textContent = all.length + ' projects in the current edition';
      render();
    })
    .catch(function () {
      listEl.innerHTML = '';
      var p = document.createElement('p');
      p.className = 'art-note';
      p.textContent = 'The latest projects are loading — please refresh in a moment.';
      listEl.appendChild(p);
      if (countEl) countEl.textContent = 'Loading…';
    });
})();
