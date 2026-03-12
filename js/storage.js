/**
 * storage.js – thin wrapper around localStorage for all data persistence.
 *
 * Each entity (clientes, equipamentos, pecas, ordens) is stored as a
 * JSON-serialised array under its own key.  A monotonically-incrementing
 * counter is used to generate simple numeric IDs.
 */

var Storage = (function () {
  var KEYS = {
    clientes:     'oa_clientes',
    equipamentos: 'oa_equipamentos',
    pecas:        'oa_pecas',
    ordens:       'oa_ordens',
    counters:     'oa_counters',
  };

  function _read(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage write error:', e);
    }
  }

  function getAll(entity) {
    return _read(KEYS[entity]) || [];
  }

  function save(entity, records) {
    _write(KEYS[entity], records);
  }

  function nextId(entity) {
    var counters = _read(KEYS.counters) || {};
    counters[entity] = (counters[entity] || 0) + 1;
    _write(KEYS.counters, counters);
    return counters[entity];
  }

  function getById(entity, id) {
    return getAll(entity).find(function (r) { return r.id === id; }) || null;
  }

  function insert(entity, record) {
    record.id = nextId(entity);
    var records = getAll(entity);
    records.push(record);
    save(entity, records);
    return record;
  }

  function update(entity, updated) {
    var records = getAll(entity).map(function (r) {
      return r.id === updated.id ? updated : r;
    });
    save(entity, records);
    return updated;
  }

  function remove(entity, id) {
    var records = getAll(entity).filter(function (r) { return r.id !== id; });
    save(entity, records);
  }

  return { getAll: getAll, save: save, getById: getById, insert: insert, update: update, remove: remove };
})();
