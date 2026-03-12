/**
 * ordens.js – CRUD for Ordens de Serviço (Service Orders).
 */

var Ordens = (function () {
  var ENTITY = 'ordens';
  var STATUS_LIST = ['Aberta', 'Em andamento', 'Concluída', 'Cancelada'];

  function _clienteNome(id) {
    if (!id) return '–';
    var c = Storage.getById('clientes', Number(id));
    return c ? c.nome : '–';
  }

  function _equipamentoNome(id) {
    if (!id) return '–';
    var e = Storage.getById('equipamentos', Number(id));
    return e ? e.descricao : '–';
  }

  function renderTable() {
    var records = Storage.getAll(ENTITY);
    var tbody = document.getElementById('ordens-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhuma ordem de serviço registrada.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(function (o) {
      var clienteNome = _clienteNome(o.clienteId);
      var equipNome   = _equipamentoNome(o.equipamentoId);
      var searchable  = [String(o.id), clienteNome, equipNome, o.descricao, o.status].join(' ');
      return '<tr data-searchable="' + escapeHtml(searchable) + '">' +
        '<td>' + o.id + '</td>' +
        '<td>' + escapeHtml(clienteNome) + '</td>' +
        '<td>' + escapeHtml(equipNome) + '</td>' +
        '<td>' + escapeHtml(o.descricao || '–') + '</td>' +
        '<td>' + statusBadge(o.status) + '</td>' +
        '<td>' + formatDate(o.dataAbertura) + '</td>' +
        '<td>' +
          '<button class="btn-icon" title="Editar" onclick="Ordens.edit(' + o.id + ')">✏️</button>' +
          '<button class="btn-icon" title="Excluir" onclick="Ordens.confirmDelete(' + o.id + ')">🗑️</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function _statusOptions(selected) {
    return STATUS_LIST.map(function (s) {
      return '<option value="' + escapeHtml(s) + '"' + (s === selected ? ' selected' : '') + '>' + escapeHtml(s) + '</option>';
    }).join('');
  }

  function _clienteOptions(selected) {
    var opts = '<option value="">— Selecione —</option>';
    Storage.getAll('clientes').forEach(function (c) {
      var sel = String(c.id) === String(selected) ? ' selected' : '';
      opts += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.nome) + '</option>';
    });
    return opts;
  }

  function _equipOptions(selected) {
    var opts = '<option value="">— Selecione —</option>';
    Storage.getAll('equipamentos').forEach(function (e) {
      var sel = String(e.id) === String(selected) ? ' selected' : '';
      opts += '<option value="' + e.id + '"' + sel + '>' + escapeHtml(e.descricao) + '</option>';
    });
    return opts;
  }

  function getForm(data) {
    data = data || {};
    return '<div class="form-row">' +
      '<div class="form-group"><label>Cliente</label>' +
        '<select id="f-clienteId">' + _clienteOptions(data.clienteId) + '</select></div>' +
      '<div class="form-group"><label>Equipamento</label>' +
        '<select id="f-equipamentoId">' + _equipOptions(data.equipamentoId) + '</select></div>' +
    '</div>' +
    '<div class="form-group"><label>Descrição do Serviço *</label>' +
      '<textarea id="f-descricao" rows="3" maxlength="600">' + escapeHtml(data.descricao || '') + '</textarea></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Status</label>' +
        '<select id="f-status">' + _statusOptions(data.status || 'Aberta') + '</select></div>' +
      '<div class="form-group"><label>Data de Abertura</label>' +
        '<input type="date" id="f-dataAbertura" value="' + escapeHtml(data.dataAbertura || today()) + '" /></div>' +
    '</div>' +
    '<div class="form-group"><label>Observações</label>' +
      '<textarea id="f-obs" rows="2" maxlength="500">' + escapeHtml(data.obs || '') + '</textarea></div>';
  }

  function collectForm() {
    return {
      clienteId:     document.getElementById('f-clienteId').value || null,
      equipamentoId: document.getElementById('f-equipamentoId').value || null,
      descricao:     document.getElementById('f-descricao').value.trim(),
      status:        document.getElementById('f-status').value,
      dataAbertura:  document.getElementById('f-dataAbertura').value,
      obs:           document.getElementById('f-obs').value.trim(),
    };
  }

  function openNew() {
    openModal('Nova Ordem de Serviço', getForm(), function () {
      var data = collectForm();
      if (!data.descricao) { showToast('Informe a descrição do serviço.', 'error'); return; }
      Storage.insert(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Ordem de serviço criada com sucesso!');
      Dashboard.refresh();
    });
  }

  function edit(id) {
    var record = Storage.getById(ENTITY, id);
    if (!record) return;
    openModal('Editar Ordem de Serviço', getForm(record), function () {
      var data = collectForm();
      if (!data.descricao) { showToast('Informe a descrição do serviço.', 'error'); return; }
      data.id = id;
      Storage.update(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Ordem de serviço atualizada!');
      Dashboard.refresh();
    });
  }

  function confirmDelete(id) {
    openConfirm('Deseja realmente excluir esta ordem de serviço?', function () {
      Storage.remove(ENTITY, id);
      renderTable();
      showToast('Ordem de serviço removida.', 'info');
      Dashboard.refresh();
    });
  }

  function getRecent(limit) {
    var all = Storage.getAll(ENTITY);
    return all.slice(-Math.min(limit || 5, all.length)).reverse();
  }

  return { renderTable: renderTable, openNew: openNew, edit: edit, confirmDelete: confirmDelete, getRecent: getRecent };
})();
