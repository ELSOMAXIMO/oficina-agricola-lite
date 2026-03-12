/**
 * clientes.js – CRUD for Clientes (Customers).
 */

var Clientes = (function () {
  var ENTITY = 'clientes';

  function renderTable() {
    var records = Storage.getAll(ENTITY);
    var tbody = document.getElementById('clientes-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum cliente cadastrado.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(function (c) {
      var searchable = [c.nome, c.telefone, c.email, c.cidade].join(' ');
      return '<tr data-searchable="' + escapeHtml(searchable) + '">' +
        '<td>' + c.id + '</td>' +
        '<td>' + escapeHtml(c.nome) + '</td>' +
        '<td>' + escapeHtml(c.telefone || '–') + '</td>' +
        '<td>' + escapeHtml(c.email || '–') + '</td>' +
        '<td>' + escapeHtml(c.cidade || '–') + '</td>' +
        '<td>' +
          '<button class="btn-icon" title="Editar" onclick="Clientes.edit(' + c.id + ')">✏️</button>' +
          '<button class="btn-icon" title="Excluir" onclick="Clientes.confirmDelete(' + c.id + ')">🗑️</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function getForm(data) {
    data = data || {};
    return '<div class="form-group"><label>Nome *</label>' +
      '<input type="text" id="f-nome" value="' + escapeHtml(data.nome || '') + '" maxlength="120" /></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Telefone</label>' +
          '<input type="tel" id="f-telefone" value="' + escapeHtml(data.telefone || '') + '" maxlength="20" /></div>' +
        '<div class="form-group"><label>E-mail</label>' +
          '<input type="email" id="f-email" value="' + escapeHtml(data.email || '') + '" maxlength="120" /></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Cidade</label>' +
          '<input type="text" id="f-cidade" value="' + escapeHtml(data.cidade || '') + '" maxlength="80" /></div>' +
        '<div class="form-group"><label>Estado</label>' +
          '<input type="text" id="f-estado" value="' + escapeHtml(data.estado || '') + '" maxlength="2" /></div>' +
      '</div>' +
      '<div class="form-group"><label>Observações</label>' +
        '<textarea id="f-obs" rows="3" maxlength="500">' + escapeHtml(data.obs || '') + '</textarea></div>';
  }

  function collectForm() {
    return {
      nome:     document.getElementById('f-nome').value.trim(),
      telefone: document.getElementById('f-telefone').value.trim(),
      email:    document.getElementById('f-email').value.trim(),
      cidade:   document.getElementById('f-cidade').value.trim(),
      estado:   document.getElementById('f-estado').value.trim().toUpperCase(),
      obs:      document.getElementById('f-obs').value.trim(),
    };
  }

  function openNew() {
    openModal('Novo Cliente', getForm(), function () {
      var data = collectForm();
      if (!data.nome) { showToast('Informe o nome do cliente.', 'error'); return; }
      Storage.insert(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Cliente cadastrado com sucesso!');
      Dashboard.refresh();
    });
  }

  function edit(id) {
    var record = Storage.getById(ENTITY, id);
    if (!record) return;
    openModal('Editar Cliente', getForm(record), function () {
      var data = collectForm();
      if (!data.nome) { showToast('Informe o nome do cliente.', 'error'); return; }
      data.id = id;
      Storage.update(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Cliente atualizado com sucesso!');
      Dashboard.refresh();
    });
  }

  function confirmDelete(id) {
    openConfirm('Deseja realmente excluir este cliente?', function () {
      Storage.remove(ENTITY, id);
      renderTable();
      showToast('Cliente removido.', 'info');
      Dashboard.refresh();
    });
  }

  function getOptions() {
    return Storage.getAll(ENTITY).map(function (c) {
      return { value: c.id, label: c.nome };
    });
  }

  return { renderTable: renderTable, openNew: openNew, edit: edit, confirmDelete: confirmDelete, getOptions: getOptions };
})();
