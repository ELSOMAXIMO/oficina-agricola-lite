/**
 * utils.js – shared UI helpers.
 */

/* ── Toast notifications ── */
function showToast(message, type) {
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'success');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(function () { container.removeChild(toast); }, 300);
  }, 3000);
}

/* ── Modal ── */
var _modalSaveCallback = null;

function openModal(title, bodyHtml, onSave) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  _modalSaveCallback = onSave || null;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  _modalSaveCallback = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

document.getElementById('modal-save').addEventListener('click', function () {
  if (typeof _modalSaveCallback === 'function') {
    _modalSaveCallback();
  }
});

/* ── Confirm dialog ── */
var _confirmCallback = null;

function openConfirm(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message || 'Deseja realmente excluir este registro?';
  _confirmCallback = onConfirm || null;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  _confirmCallback = null;
}

document.getElementById('confirm-cancel').addEventListener('click', closeConfirm);
document.getElementById('confirm-ok').addEventListener('click', function () {
  if (typeof _confirmCallback === 'function') _confirmCallback();
  closeConfirm();
});

/* ── Formatting helpers ── */
function formatDate(iso) {
  if (!iso) return '–';
  var parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status) {
  var map = {
    'Aberta':     'badge-aberta',
    'Em andamento': 'badge-andamento',
    'Concluída':  'badge-concluida',
    'Cancelada':  'badge-cancelada',
  };
  var cls = map[status] || 'badge-aberta';
  return '<span class="badge ' + cls + '">' + escapeHtml(status) + '</span>';
}

/* ── Search filter ── */
function filterTable(tbodyId, query) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  var rows = tbody.querySelectorAll('tr[data-searchable]');
  var q = query.toLowerCase().trim();
  rows.forEach(function (row) {
    var text = (row.getAttribute('data-searchable') || '').toLowerCase();
    row.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
  });
}
