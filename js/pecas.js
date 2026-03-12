/**
 * pecas.js – CRUD for Peças / Estoque (Parts / Inventory).
 */

var Pecas = (function () {
  var ENTITY = 'pecas';
  var ESTOQUE_MINIMO_PADRAO = 2;

  function renderTable() {
    var records = Storage.getAll(ENTITY);
    var tbody = document.getElementById('pecas-body');
    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhuma peça cadastrada.</td></tr>';
      return;
    }
    tbody.innerHTML = records.map(function (p) {
      var searchable = [p.descricao, p.codigo].join(' ');
      var lowStock = Number(p.qtd) <= Number(p.qtdMin || ESTOQUE_MINIMO_PADRAO);
      var qtdStyle = lowStock ? ' style="color:#c62828;font-weight:700"' : '';
      return '<tr data-searchable="' + escapeHtml(searchable) + '">' +
        '<td>' + p.id + '</td>' +
        '<td>' + escapeHtml(p.descricao) + '</td>' +
        '<td>' + escapeHtml(p.codigo || '–') + '</td>' +
        '<td' + qtdStyle + '>' + escapeHtml(String(p.qtd || 0)) + (lowStock ? ' ⚠️' : '') + '</td>' +
        '<td>' + escapeHtml(String(p.qtdMin || ESTOQUE_MINIMO_PADRAO)) + '</td>' +
        '<td>' + (p.preco ? 'R$ ' + Number(p.preco).toFixed(2).replace('.', ',') : '–') + '</td>' +
        '<td>' +
          '<button class="btn-icon" title="Editar" onclick="Pecas.edit(' + p.id + ')">✏️</button>' +
          '<button class="btn-icon" title="Excluir" onclick="Pecas.confirmDelete(' + p.id + ')">🗑️</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function getForm(data) {
    data = data || {};
    return '<div class="form-group"><label>Descrição *</label>' +
      '<input type="text" id="f-descricao" value="' + escapeHtml(data.descricao || '') + '" maxlength="120" /></div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Código / Referência</label>' +
          '<input type="text" id="f-codigo" value="' + escapeHtml(data.codigo || '') + '" maxlength="40" /></div>' +
        '<div class="form-group"><label>Preço Unit. (R$)</label>' +
          '<input type="number" id="f-preco" value="' + escapeHtml(String(data.preco || '')) + '" min="0" step="0.01" /></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<div class="form-group"><label>Qtd. Atual</label>' +
          '<input type="number" id="f-qtd" value="' + escapeHtml(String(data.qtd || 0)) + '" min="0" /></div>' +
        '<div class="form-group"><label>Qtd. Mínima</label>' +
          '<input type="number" id="f-qtdMin" value="' + escapeHtml(String(data.qtdMin !== undefined ? data.qtdMin : ESTOQUE_MINIMO_PADRAO)) + '" min="0" /></div>' +
      '</div>' +
      '<div class="form-group"><label>Observações</label>' +
        '<textarea id="f-obs" rows="2" maxlength="400">' + escapeHtml(data.obs || '') + '</textarea></div>';
  }

  function collectForm() {
    return {
      descricao: document.getElementById('f-descricao').value.trim(),
      codigo:    document.getElementById('f-codigo').value.trim(),
      preco:     parseFloat(document.getElementById('f-preco').value) || 0,
      qtd:       parseInt(document.getElementById('f-qtd').value, 10) || 0,
      qtdMin:    parseInt(document.getElementById('f-qtdMin').value, 10) || 0,
      obs:       document.getElementById('f-obs').value.trim(),
    };
  }

  function openNew() {
    openModal('Nova Peça', getForm(), function () {
      var data = collectForm();
      if (!data.descricao) { showToast('Informe a descrição da peça.', 'error'); return; }
      Storage.insert(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Peça cadastrada com sucesso!');
      Dashboard.refresh();
    });
  }

  function edit(id) {
    var record = Storage.getById(ENTITY, id);
    if (!record) return;
    openModal('Editar Peça', getForm(record), function () {
      var data = collectForm();
      if (!data.descricao) { showToast('Informe a descrição da peça.', 'error'); return; }
      data.id = id;
      Storage.update(ENTITY, data);
      renderTable();
      closeModal();
      showToast('Peça atualizada com sucesso!');
      Dashboard.refresh();
    });
  }

  function confirmDelete(id) {
    openConfirm('Deseja realmente excluir esta peça?', function () {
      Storage.remove(ENTITY, id);
      renderTable();
      showToast('Peça removida.', 'info');
      Dashboard.refresh();
    });
  }

  function getLowStock() {
    return Storage.getAll(ENTITY).filter(function (p) {
      return Number(p.qtd) <= Number(p.qtdMin !== undefined ? p.qtdMin : ESTOQUE_MINIMO_PADRAO);
    });
  }

  function getOptions() {
    return Storage.getAll(ENTITY).map(function (p) {
      return { value: p.id, label: p.descricao + (p.codigo ? ' (' + p.codigo + ')' : '') };
    });
  }

  return { renderTable: renderTable, openNew: openNew, edit: edit, confirmDelete: confirmDelete, getLowStock: getLowStock, getOptions: getOptions };
})();
