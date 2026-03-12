/**
 * equipamentos.js – CRUD for Equipamentos (Agricultural machinery / equipment).
 */

var Equipamentos = (function () {
  var ENTITY = 'equipamentos';

  function renderTable() {
    var records = Storage.getAll(ENTITY);
    var tbody = document.getElementById('equipamentos-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum equipamento cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(function (e) {
      var clienteNome = _clienteNome(e.clienteId);
      var searchable = [e.descricao, e.marca, e.modelo, e.serie, clienteNome].join(' ');
      return '<tr data-searchable="' + escapeHtml(searchable) + '">' +
        '<td>' + e.id + '</td>' +
        '<td>' + escapeHtml(e.descricao) + '</td>' +
        '<td>' + escapeHtml((e.marca || '') + (e.modelo ? ' ' + e.modelo : '')) + '</td>' +
        '<td>' + escapeHtml(e.serie || '–') + '</td>' +
        '<td>' + escapeHtml(clienteNome) + '</td>' +
        '<td>' +
          '<button class="btn-icon" title="Editar" onclick="Equipamentos.edit(' + e.id + ')">✏️</button>' +
          '<button class="btn-icon" title="Excluir" onclick="Equipamentos.confirmDelete(' + e.id + ')">🗑️</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function _clienteNome(clienteId) {
    if (!clienteId) return '–';
    var c = Storage.getById('clientes', Number(clienteId));
    return c ? c.nome : '–';
  }

  function _clienteOptions(selected) {
    var opts = '<option value="">— Selecione —</option>';
    Storage.getAll('clientes').forEach(function (c) {
      var sel = String(c.id) === String(selected) ? ' selected' : '';
      opts += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.nome) + '</option>';
    });
    return opts;
  }

  function getForm(data) {
    data = data || {};
    return '<div class="form-group"><label>Descrição *</label>' +
      '<input type="text" id="f-descricao" value="' + escapeHtml(data.descricao || '') + '" maxlength="120" /></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Marca</label>' +
          '<input type="text" id="f-marca" value="' + escapeHtml(data.marca || '') + '" maxlength="60" /></div>' +
        '<div class="form-group"><label>Modelo</label>' +
          '<input type="text" id="f-modelo" value="' + escapeHtml(data.modelo || '') + '" maxlength="60" /></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Número de Série</label>' +
          '<input type="text" id="f-serie" value="' + escapeHtml(data.serie || '') + '" maxlength="60" /></div>' +
        '<div class="form-group"><label>Ano de Fabricação</label>' +
          '<input type="number" id="f-ano" value="' + escapeHtml(String(data.ano || '')) + '" min="1900" max="2100" /></div>' +
      '</div>' +
      '<div class="form-group"><label>Cliente Proprietário</label>' +
        '<select id="f-clienteId">' + _clienteOptions(data.clienteId) + '</select></div>' +
      '<div class="form-group"><label>Observações</label>' +
        '<textarea id="f-obs" rows="2" maxlength="400">' + escapeHtml(data.obs || '') + '</textarea></div>';
  }

  function collectForm() {
    return {
      descricao: document.getElementById('f-descricao').value.trim(),
      marca:     document.getElementById('f-marca').value.trim(),
      modelo:    document.getElementById('f-modelo').value.trim(),
      serie:     document.getElementById('f-serie').value.trim(),
      ano:       document.getElementById('f-ano').value.trim(),
      clienteId: document.getElementById('f-clienteId').value || null,
      obs:       document.getElementById('f-obs').value.trim(),
    };
  }

  function openNew() {
    openModal('Novo Equipamento', getForm(), function () {
      var data = collectForm();
      if (!data.descricao) { showToast('Informe a descrição do equipamento.', 'error'); return; }
      Storage.insert(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Equipamento cadastrado com sucesso!');
      Dashboard.refresh();
    });
  }

  function edit(id) {
    var record = Storage.getById(ENTITY, id);
    if (!record) return;
    openModal('Editar Equipamento', getForm(record), function () {
      var data = collectForm();
      if (!data.descricao) { showToast('Informe a descrição do equipamento.', 'error'); return; }
      data.id = id;
      Storage.update(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Equipamento atualizado com sucesso!');
      Dashboard.refresh();
    });
  }

  function confirmDelete(id) {
    openConfirm('Deseja realmente excluir este equipamento?', function () {
      Storage.remove(ENTITY, id);
      renderTable();
      showToast('Equipamento removido.', 'info');
      Dashboard.refresh();
    });
  }

  function getOptions() {
    return Storage.getAll(ENTITY).map(function (e) {
      return { value: e.id, label: e.descricao + (e.marca ? ' – ' + e.marca : '') };
    });
  }

  return { renderTable: renderTable, openNew: openNew, edit: edit, confirmDelete: confirmDelete, getOptions: getOptions };
})();
