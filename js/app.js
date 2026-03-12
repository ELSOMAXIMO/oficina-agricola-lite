/**
 * app.js – wires up navigation, action buttons, search, and bootstraps the app.
 */

(function () {
  /* ── Page navigation ── */
  var pageTitles = {
    dashboard:    'Dashboard',
    ordens:       'Ordens de Serviço',
    clientes:     'Clientes',
    equipamentos: 'Equipamentos',
    pecas:        'Peças / Estoque',
  };

  var onEnterPage = {
    dashboard:    function () { Dashboard.refresh(); },
    ordens:       function () { Ordens.renderTable(); },
    clientes:     function () { Clientes.renderTable(); },
    equipamentos: function () { Equipamentos.renderTable(); },
    pecas:        function () { Pecas.renderTable(); },
  };

  function navigateTo(page) {
    /* update nav items */
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.page === page);
    });

    /* update page sections */
    document.querySelectorAll('.page').forEach(function (section) {
      section.classList.toggle('active', section.id === 'page-' + page);
    });

    /* update topbar title */
    document.getElementById('page-title').textContent = pageTitles[page] || page;

    /* run page-specific initialiser */
    if (onEnterPage[page]) onEnterPage[page]();

    /* close sidebar on mobile */
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }
  }

  /* Nav menu clicks */
  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function () {
      navigateTo(item.dataset.page);
    });
  });

  /* "data-nav" buttons (e.g. dashboard "Ver todas") */
  document.querySelectorAll('[data-nav]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigateTo(btn.dataset.nav);
    });
  });

  /* ── Mobile sidebar toggle ── */
  var sidebar = document.getElementById('sidebar');
  var mainContent = document.getElementById('main-content');

  document.getElementById('menu-toggle').addEventListener('click', function () {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
    } else {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('expanded');
    }
  });

  /* Close sidebar when clicking outside on mobile */
  document.addEventListener('click', function (e) {
    if (window.innerWidth <= 768 &&
        !sidebar.contains(e.target) &&
        e.target.id !== 'menu-toggle') {
      sidebar.classList.remove('open');
    }
  });

  /* ── Action buttons ── */
  document.getElementById('btn-nova-ordem').addEventListener('click', function () { Ordens.openNew(); });
  document.getElementById('btn-novo-cliente').addEventListener('click', function () { Clientes.openNew(); });
  document.getElementById('btn-novo-equipamento').addEventListener('click', function () { Equipamentos.openNew(); });
  document.getElementById('btn-nova-peca').addEventListener('click', function () { Pecas.openNew(); });

  /* ── Search inputs ── */
  document.getElementById('search-ordens').addEventListener('input', function () {
    filterTable('ordens-body', this.value);
  });
  document.getElementById('search-clientes').addEventListener('input', function () {
    filterTable('clientes-body', this.value);
  });
  document.getElementById('search-equipamentos').addEventListener('input', function () {
    filterTable('equipamentos-body', this.value);
  });
  document.getElementById('search-pecas').addEventListener('input', function () {
    filterTable('pecas-body', this.value);
  });

  /* ── Date in topbar ── */
  (function updateDate() {
    var el = document.getElementById('current-date');
    var now = new Date();
    var days   = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    el.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  })();

  /* ── Boot ── */
  navigateTo('dashboard');
})();
