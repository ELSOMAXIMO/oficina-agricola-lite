import initSqlJs, { Database } from 'sql.js';
import sqlWasm from 'sql.js/dist/sql-wasm.wasm?url';
import localforage from 'localforage';

let db: Database | null = null;
const DB_NAME = 'automecanica_sql_db';

const SCHEMA_STATEMENTS = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    uid TEXT UNIQUE,
    nome TEXT,
    email TEXT UNIQUE,
    senha TEXT,
    role TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id TEXT PRIMARY KEY,
    uid TEXT,
    nome TEXT,
    email TEXT,
    telefone TEXT,
    cpf_cnpj TEXT,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    logradouro TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    cep TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS veiculos (
    id TEXT PRIMARY KEY,
    uid TEXT,
    clienteId TEXT,
    clienteNome TEXT,
    modelo TEXT,
    marca TEXT,
    ano INTEGER,
    placa TEXT,
    placa_serie TEXT,
    cor TEXT,
    chassi TEXT,
    km TEXT,
    tipo TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS pecas (
    id TEXT PRIMARY KEY,
    uid TEXT,
    codigo TEXT,
    descricao TEXT,
    marca TEXT,
    precoCusto REAL,
    precoVenda REAL,
    estoque REAL,
    estoqueMinimo REAL,
    unidade TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS ordens_servico (
    id TEXT PRIMARY KEY,
    uid TEXT,
    numero TEXT,
    clienteId TEXT,
    clienteNome TEXT,
    veiculoId TEXT,
    status TEXT,
    tecnicoResponsavel TEXT,
    descricao TEXT,
    problemaRelatado TEXT,
    diagnostico TEXT,
    servicos TEXT,
    pecas TEXT,
    fotos TEXT,
    valorTotal REAL,
    dataAbertura DATETIME,
    dataFinalizacao DATETIME,
    dataEntrada DATETIME,
    dataSaida DATETIME,
    previsaoEntrega DATETIME,
    quilometragemInicial TEXT,
    quilometragemFinal TEXT,
    observacoes TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS orcamentos (
    id TEXT PRIMARY KEY,
    uid TEXT,
    numero TEXT,
    clienteId TEXT,
    clienteNome TEXT,
    veiculoId TEXT,
    status TEXT,
    tecnicoResponsavel TEXT,
    descricao TEXT,
    servicos TEXT,
    pecas TEXT,
    fotos TEXT,
    valorTotal REAL,
    validade TEXT,
    quilometragemInicial TEXT,
    quilometragemFinal TEXT,
    observacoes TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS configuracoes (
    id TEXT PRIMARY KEY,
    uid TEXT,
    nomeOficina TEXT,
    cnpj TEXT,
    inscricaoMunicipal TEXT,
    inscricaoEstadual TEXT,
    endereco TEXT,
    complemento TEXT,
    bairro TEXT,
    cep TEXT,
    cidade TEXT,
    uf TEXT,
    telefone TEXT,
    email TEXT,
    logo TEXT,
    termoGarantia TEXT,
    validadePadraoOrcamento INTEGER,
    tecnicoPadrao TEXT,
    exibirLogoNoPdf INTEGER,
    exibirFotosNoPdf INTEGER,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY,
    uid TEXT,
    clienteId TEXT,
    clienteNome TEXT,
    veiculoId TEXT,
    osId TEXT,
    data DATETIME,
    hora TEXT,
    servico TEXT,
    descricao TEXT,
    local TEXT,
    status TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS documentos_pdf (
    id TEXT PRIMARY KEY,
    uid TEXT,
    recordType TEXT,
    recordId TEXT,
    fileName TEXT,
    mimeType TEXT,
    base64Content TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

const addColumnIfMissing = (table: string, column: string, type: string) => {
  if (!db) return;

  const columns = db.exec(`PRAGMA table_info(${table})`)[0]?.values ?? [];
  const hasColumn = columns.some(([, name]) => name === column);

  if (!hasColumn) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

const migrateSchema = () => {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS documentos_pdf (
      id TEXT PRIMARY KEY,
      uid TEXT,
      recordType TEXT,
      recordId TEXT,
      fileName TEXT,
      mimeType TEXT,
      base64Content TEXT,
      createdAt DATETIME,
      updatedAt DATETIME
    )
  `);

  const tableColumns: Record<string, Array<[string, string]>> = {
    usuarios: [
      ['id', 'TEXT'],
      ['uid', 'TEXT'],
      ['updatedAt', 'DATETIME'],
    ],
    clientes: [
      ['inscricao_estadual', 'TEXT'],
      ['inscricao_municipal', 'TEXT'],
      ['complemento', 'TEXT'],
      ['endereco', 'TEXT'],
      ['updatedAt', 'DATETIME'],
    ],
    veiculos: [
      ['clienteNome', 'TEXT'],
      ['placa', 'TEXT'],
      ['cor', 'TEXT'],
      ['chassi', 'TEXT'],
      ['km', 'TEXT'],
      ['updatedAt', 'DATETIME'],
    ],
    pecas: [
      ['updatedAt', 'DATETIME'],
    ],
    ordens_servico: [
      ['clienteNome', 'TEXT'],
      ['problemaRelatado', 'TEXT'],
      ['diagnostico', 'TEXT'],
      ['servicos', 'TEXT'],
      ['pecas', 'TEXT'],
      ['fotos', 'TEXT'],
      ['dataEntrada', 'DATETIME'],
      ['dataSaida', 'DATETIME'],
      ['previsaoEntrega', 'DATETIME'],
      ['updatedAt', 'DATETIME'],
    ],
    orcamentos: [
      ['clienteNome', 'TEXT'],
      ['servicos', 'TEXT'],
      ['pecas', 'TEXT'],
      ['fotos', 'TEXT'],
      ['quilometragemInicial', 'TEXT'],
      ['quilometragemFinal', 'TEXT'],
      ['updatedAt', 'DATETIME'],
    ],
    configuracoes: [
      ['inscricaoMunicipal', 'TEXT'],
      ['inscricaoEstadual', 'TEXT'],
      ['complemento', 'TEXT'],
      ['bairro', 'TEXT'],
      ['cep', 'TEXT'],
      ['cidade', 'TEXT'],
      ['uf', 'TEXT'],
      ['termoGarantia', 'TEXT'],
      ['validadePadraoOrcamento', 'INTEGER'],
      ['tecnicoPadrao', 'TEXT'],
      ['exibirLogoNoPdf', 'INTEGER'],
      ['exibirFotosNoPdf', 'INTEGER'],
      ['updatedAt', 'DATETIME'],
    ],
    agendamentos: [
      ['clienteNome', 'TEXT'],
      ['veiculoId', 'TEXT'],
      ['osId', 'TEXT'],
      ['hora', 'TEXT'],
      ['servico', 'TEXT'],
      ['status', 'TEXT'],
      ['updatedAt', 'DATETIME'],
    ],
    documentos_pdf: [
      ['uid', 'TEXT'],
      ['recordType', 'TEXT'],
      ['recordId', 'TEXT'],
      ['fileName', 'TEXT'],
      ['mimeType', 'TEXT'],
      ['base64Content', 'TEXT'],
      ['createdAt', 'DATETIME'],
      ['updatedAt', 'DATETIME'],
    ],
  };

  Object.entries(tableColumns).forEach(([table, columns]) => {
    columns.forEach(([name, type]) => addColumnIfMissing(table, name, type));
  });

  db.run(`UPDATE usuarios SET id = uid WHERE id IS NULL OR id = ''`);
  db.run(`UPDATE usuarios SET uid = id WHERE uid IS NULL OR uid = ''`);
  db.run(`UPDATE system_config SET value = 'false' WHERE key = 'initialized' AND NOT EXISTS (SELECT 1 FROM usuarios WHERE senha IS NOT NULL)`);
  db.run(`INSERT OR IGNORE INTO system_config (key, value) VALUES ('initialized', 'false')`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_id ON usuarios(id)`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
};

export const sqlDbService = {
  async init() {
    if (db) return db;

    try {
      // Add a timeout to WASM initialization to prevent hanging
      const SQL = await Promise.race([
        initSqlJs({
          locateFile: () => sqlWasm
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao carregar motor de banco de dados (WASM)")), 5000))
      ]) as any;

      const savedDb: Uint8Array | null = await localforage.getItem(DB_NAME);

      if (savedDb) {
        db = new SQL.Database(savedDb);
      } else {
        db = new SQL.Database();
        this.createTables();
      }

      migrateSchema();
      await this.save();

      return db;
    } catch (error) {
      console.error("Erro ao inicializar banco de dados SQL:", error);
      throw error;
    }
  },

  createTables() {
    if (!db) return;

    db.run(SCHEMA_STATEMENTS);
    db.run("INSERT OR IGNORE INTO system_config (key, value) VALUES ('initialized', 'false')");
  },

  async save() {
    if (!db) return;
    const data = db.export();
    await localforage.setItem(DB_NAME, data);
  },

  async query(sql: string, params: any[] = []) {
    const database = await this.init();
    const stmt = database.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async run(sql: string, params: any[] = []) {
    const database = await this.init();
    database.run(sql, params);
    await this.save();
  },

  async getTableColumns(tableName: string) {
    const database = await this.init();
    const result = database.exec(`PRAGMA table_info(${tableName})`);

    if (!result[0]) {
      return [] as string[];
    }

    return result[0].values.map(([, name]) => String(name));
  },

  async import(data: Uint8Array) {
    const SQL = await Promise.race([
      initSqlJs({
        locateFile: () => sqlWasm
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao carregar motor de banco de dados (WASM)")), 5000))
    ]) as any;
    db = new SQL.Database(data);
    await this.save();
  }
};
