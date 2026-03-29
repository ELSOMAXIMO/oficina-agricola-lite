import { sqlDbService } from './sqlDbService';

const ALLOWED_COLLECTIONS = new Set([
  'usuarios',
  'clientes',
  'veiculos',
  'pecas',
  'ordens_servico',
  'orcamentos',
  'configuracoes',
  'agendamentos',
  'documentos_pdf',
]);

const normalizeValue = (value: unknown) => {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return JSON.stringify(value);
  }

  return value;
};

const ensureCollection = (collectionName: string) => {
  if (!ALLOWED_COLLECTIONS.has(collectionName)) {
    throw new Error(`Coleção inválida: ${collectionName}`);
  }
};

const JSON_FIELDS_BY_COLLECTION: Record<string, string[]> = {
  ordens_servico: ['servicos', 'pecas', 'fotos'],
  orcamentos: ['servicos', 'pecas', 'fotos'],
};

const BOOLEAN_FIELDS_BY_COLLECTION: Record<string, string[]> = {
  configuracoes: ['exibirLogoNoPdf', 'exibirFotosNoPdf'],
};

const deserializeValue = (collectionName: string, key: string, value: unknown) => {
  if (value == null) {
    return value;
  }

  if (BOOLEAN_FIELDS_BY_COLLECTION[collectionName]?.includes(key)) {
    if (value === 1 || value === '1') {
      return true;
    }

    if (value === 0 || value === '0') {
      return false;
    }
  }

  if (JSON_FIELDS_BY_COLLECTION[collectionName]?.includes(key) && typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return key === 'fotos' || key === 'pecas' || key === 'servicos' ? [] : value;
    }
  }

  return value;
};

const deserializeRow = (collectionName: string, row: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, deserializeValue(collectionName, key, value)])
  );
};

export const dbService = {
  async list(collectionName: string, uid: string, callback: (data: any[]) => void) {
    try {
      ensureCollection(collectionName);
      const results = await sqlDbService.query(
        collectionName === 'usuarios'
          ? `SELECT * FROM ${collectionName} WHERE uid = ? OR id = ? ORDER BY createdAt DESC`
          : `SELECT * FROM ${collectionName} WHERE uid = ? ORDER BY createdAt DESC`,
        collectionName === 'usuarios' ? [uid, uid] : [uid]
      );
      callback(results.map((row) => deserializeRow(collectionName, row as Record<string, unknown>)));
      
      // Since it's local SQL, we don't have real-time listeners like Firestore,
      // but we can return a dummy unsubscribe.
      return () => {};
    } catch (error) {
      console.error(`Error listing ${collectionName}:`, error);
      callback([]);
      return () => {};
    }
  },

  async create(collectionName: string, data: any) {
    try {
      ensureCollection(collectionName);
      const tableColumns = await sqlDbService.getTableColumns(collectionName);
      const id = data.id || Math.random().toString(36).slice(2) + Date.now().toString(36);
      const uid = data.uid || id;
      const now = new Date().toISOString();

      const payload = Object.fromEntries(
        Object.entries({ ...data, id, uid, createdAt: data.createdAt || now, updatedAt: data.updatedAt || now })
          .filter(([key]) => tableColumns.includes(key))
          .map(([key, value]) => [key, normalizeValue(value)])
      );

      const fields = Object.keys(payload);
      const placeholders = fields.map(() => '?').join(', ');
      const sql = `INSERT INTO ${collectionName} (${fields.join(', ')}) VALUES (${placeholders})`;
      const params = fields.map(field => payload[field]);

      await sqlDbService.run(sql, params);
      return payload;
    } catch (error) {
      console.error(`Error creating in ${collectionName}:`, error);
      throw error;
    }
  },

  async update(collectionName: string, id: string, data: any) {
    try {
      ensureCollection(collectionName);
      const tableColumns = await sqlDbService.getTableColumns(collectionName);
      const payload = Object.fromEntries(
        Object.entries({ ...data, updatedAt: new Date().toISOString() })
          .filter(([key]) => key !== 'id' && tableColumns.includes(key))
          .map(([key, value]) => [key, normalizeValue(value)])
      );

      const fields = Object.keys(payload);
      if (fields.length === 0) {
        return { id, ...data };
      }

      const sets = fields.map(f => `${f} = ?`).join(', ');
      const sql = `UPDATE ${collectionName} SET ${sets} WHERE id = ?`;
      const params = [...fields.map(f => payload[f]), id];

      await sqlDbService.run(sql, params);
      return { id, ...data };
    } catch (error) {
      console.error(`Error updating ${collectionName}:`, error);
      throw error;
    }
  },

  async delete(collectionName: string, id: string, _uid: string) {
    try {
      ensureCollection(collectionName);
      await sqlDbService.run(`DELETE FROM ${collectionName} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error(`Error deleting from ${collectionName}:`, error);
      throw error;
    }
  }
};
