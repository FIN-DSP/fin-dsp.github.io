/* Active Projects — FIN-DSP's own projects from projects.json
   (origin === 'FIN-DSP'), rendered as showcase cards. */
(function () {
  var listEl = document.getElementById('activeList');
  fetch('projects.json')
    .then(function (r) { if (!r.ok) throw new Error('projects'); return r.json(); })
    .then(function (data) {
      var arr = Array.isArray(data) ? data : (data.projects || []);
      var own = arr.filter(function (a) { return (a.origin || '') === 'FIN-DSP'; });
      listEl.innerHTML = '';
      if (!own.length) {
        var p = document.createElement('p');
        p.className = 'art-note';
        p.textContent = 'No active projects listed yet — check back soon.';
        listEl.appendChild(p);
        return;
      }
      own.forEach(function (a) {
        var url = a.url || '';
        var card = document.createElement('article');
        card.className = 'article-card';
        var meta = document.createElement('div');
        meta.className = 'a-meta';
        meta.textContent = [a.category, a.repo].filter(Boolean).join(' · ');
        card.appendChild(meta);
        var h = document.createElement('h3');
        if (url) {
          var link = document.createElement('a');
          link.href = url; link.target = '_blank'; link.rel = 'noopener';
          link.textContent = a.name || a.title || url;
          h.appendChild(link);
        } else {
          h.textContent = a.name || a.title || '';
        }
        card.appendChild(h);
        var ex = a.description || a.excerpt || '';
        if (ex) {
          var p2 = document.createElement('p');
          p2.textContent = ex;
          card.appendChild(p2);
        }
        if (url) {
          var more = document.createElement('a');
          more.className = 'a-more';
          more.href = url; more.target = '_blank'; more.rel = 'noopener';
          more.textContent = 'View on GitHub';
          card.appendChild(more);
        }
        listEl.appendChild(card);
      });
    })
    .catch(function () {
      listEl.innerHTML = '';
      var p = document.createElement('p');
      p.className = 'art-note';
      p.textContent = 'The active projects are loading — please refresh in a moment.';
      listEl.appendChild(p);
    });
})();
