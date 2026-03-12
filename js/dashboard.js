/**
 * dashboard.js – renders summary stats and recent records on the dashboard.
 */

var Dashboard = (function () {
  function refresh() {
    var ordens = Storage.getAll('ordens');
    var openOrdens = ordens.filter(function (o) { return o.status === 'Aberta' || o.status === 'Em andamento'; });

    document.getElementById('stat-ordens').textContent       = openOrdens.length;
    document.getElementById('stat-clientes').textContent     = Storage.getAll('clientes').length;
    document.getElementById('stat-equipamentos').textContent = Storage.getAll('equipamentos').length;
    document.getElementById('stat-pecas').textContent        = Storage.getAll('pecas').length;

    _renderRecentOrdens();
    _renderLowStock();
  }

  function _renderRecentOrdens() {
    var recent = Ordens.getRecent(5);
    var tbody = document.getElementById('dashboard-ordens-body');
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Nenhuma ordem de serviço registrada.</td></tr>';
      return;
    }
    tbody.innerHTML = recent.map(function (o) {
      var cNome = o.clienteId ? (Storage.getById('clientes', Number(o.clienteId)) || {}).nome || '–' : '–';
      var eNome = o.equipamentoId ? (Storage.getById('equipamentos', Number(o.equipamentoId)) || {}).descricao || '–' : '–';
      return '<tr>' +
        '<td>' + o.id + '</td>' +
        '<td>' + escapeHtml(cNome) + '</td>' +
        '<td>' + escapeHtml(eNome) + '</td>' +
        '<td>' + statusBadge(o.status) + '</td>' +
        '<td>' + formatDate(o.dataAbertura) + '</td>' +
      '</tr>';
    }).join('');
  }

  function _renderLowStock() {
    var lowItems = Pecas.getLowStock().slice(0, 6);
    var tbody = document.getElementById('dashboard-estoque-body');
    if (!lowItems.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-message">Nenhum item com estoque baixo.</td></tr>';
      return;
    }
    tbody.innerHTML = lowItems.map(function (p) {
      return '<tr>' +
        '<td>' + escapeHtml(p.descricao) + '</td>' +
        '<td>' + escapeHtml(p.codigo || '–') + '</td>' +
        '<td style="color:#c62828;font-weight:700">' + p.qtd + '</td>' +
        '<td>' + (p.qtdMin !== undefined ? p.qtdMin : 2) + '</td>' +
      '</tr>';
    }).join('');
  }

  return { refresh: refresh };
})();
