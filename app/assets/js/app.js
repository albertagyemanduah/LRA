/* Land Registry admin console — progressive enhancement only. */
(function () {
  'use strict';

  // ---- Sidebar toggle (mobile) ----
  var toggle = document.getElementById('sidebarToggle');
  var sidebar = document.getElementById('appSidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () { sidebar.classList.toggle('show'); });
    document.addEventListener('click', function (e) {
      if (window.innerWidth < 992 && sidebar.classList.contains('show') &&
          !sidebar.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
        sidebar.classList.remove('show');
      }
    });
  }

  // ---- Theme toggle ----
  var THEME_KEY = 'lra_theme';
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) root.setAttribute('data-bs-theme', saved);
  } catch (_) {}
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    var sync = function () {
      var dark = root.getAttribute('data-bs-theme') === 'dark';
      themeBtn.innerHTML = '<i class="bi bi-' + (dark ? 'sun' : 'moon-stars') + '"></i>';
    };
    sync();
    themeBtn.addEventListener('click', function () {
      var next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-bs-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
      sync();
    });
  }

  // ---- Confirm-before-submit ----
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // ---- Row links: click a <tr data-href> to open it ----
  document.querySelectorAll('tr[data-href]').forEach(function (tr) {
    tr.classList.add('data-row-link');
    tr.addEventListener('click', function (e) {
      if (e.target.closest('a,button,input,label,select')) return;
      window.location = tr.getAttribute('data-href');
    });
  });

  // ---- Auto-submit filter forms on change ----
  document.querySelectorAll('form[data-autosubmit] select, form[data-autosubmit] input[type=date]').forEach(function (el) {
    el.addEventListener('change', function () { el.form.submit(); });
  });

  // ---- Notification bell polling ----
  var badge = document.getElementById('notifCount');
  var pollUrl = document.body.getAttribute('data-notif-poll');
  if (pollUrl) {
    setInterval(function () {
      fetch(pollUrl, { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || typeof d.unread !== 'number') return;
          if (badge) {
            badge.textContent = d.unread > 99 ? '99+' : d.unread;
            badge.style.display = d.unread ? '' : 'none';
          }
        })
        .catch(function () {});
    }, 30000);
  }
})();
