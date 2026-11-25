(function () {
  var select = document.getElementById('themeSelect');
  var THEME_KEY = 'findsp-theme';
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', select.value);
    try { localStorage.setItem(THEME_KEY, select.value); } catch (e) {}
  }
  var currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === currentTheme) { select.value = currentTheme; break; }
    }
  }
  select.addEventListener('change', applyTheme);
  select.addEventListener('input', applyTheme);
  var widthBtn = document.getElementById('widthToggle');
  function syncWidthBtn() {
    var w = document.documentElement.getAttribute('data-width') || 'nuke';
    var isFull = w === 'full';
    widthBtn.textContent = isFull ? 'WIDTH: Full' : 'WIDTH: Nuke';
    widthBtn.setAttribute('aria-pressed', isFull ? 'true' : 'false');
  }
  syncWidthBtn();
  widthBtn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-width') || 'nuke';
    var next = current === 'full' ? 'nuke' : 'full';
    document.documentElement.setAttribute('data-width', next);
    try { localStorage.setItem('ctp-width', next); } catch (e) {}
    syncWidthBtn();
  });
})();
