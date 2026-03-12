import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

dotenv.config();

const DRIVE_BACKUP_KEEP_LATEST = Math.max(1, Number(process.env.DRIVE_BACKUP_KEEP_LATEST || '3'));
const DRIVE_BACKUP_FILENAME_PREFIX = 'backup_oficina_';
const DRIVE_BACKUP_FOLDER_NAME = process.env.DRIVE_BACKUP_FOLDER_NAME || 'Oficina Agricola Lite Backups';

const hasGoogleOAuthConfig = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CLIENT_ID !== 'placeholder_id' &&
  process.env.GOOGLE_CLIENT_SECRET !== 'placeholder_secret'
);

const isBackupFileName = (fileName?: string | null) =>
  Boolean(fileName && fileName.startsWith(DRIVE_BACKUP_FILENAME_PREFIX));

const buildDriveFolderUrl = (folderId: string) => `https://drive.google.com/drive/folders/${folderId}`;

const getGoogleApiErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: string;
      errors?: Array<{ message?: string }>;
      response?: { data?: { error?: { message?: string } | string } };
    };

    if (typeof maybeError.response?.data?.error === 'string') {
      return maybeError.response.data.error;
    }

    if (typeof maybeError.response?.data?.error === 'object' && maybeError.response?.data?.error?.message) {
      return maybeError.response.data.error.message;
    }

    if (maybeError.errors?.[0]?.message) {
      return maybeError.errors[0].message;
    }

    if (maybeError.message) {
      return maybeError.message;
    }
  }

  return fallbackMessage;
};

const listAllBackupFiles = async (drive: ReturnType<typeof google.drive>) => {
  const response = await drive.files.list({
    q: 'trashed = false',
    orderBy: 'createdTime desc',
    pageSize: 200,
    fields: 'files(id, name, createdTime, size, mimeType, parents)',
    spaces: 'drive',
  });

  return (response.data.files || []).filter((file) => isBackupFileName(file.name));
};

const ensureDriveBackupFolder = async (drive: ReturnType<typeof google.drive>) => {
  try {
    const folderList = await drive.files.list({
      q: `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${DRIVE_BACKUP_FOLDER_NAME.replace(/'/g, "\\'")}'`,
      pageSize: 10,
      fields: 'files(id, name, createdTime)',
      spaces: 'drive',
      orderBy: 'createdTime desc',
    });

    const existingFolder = folderList.data.files?.[0];
    if (existingFolder?.id) {
      return existingFolder.id;
    }
  } catch (error) {
    console.warn('[DRIVE] Folder lookup failed, attempting folder creation directly:', getGoogleApiErrorMessage(error, 'Folder lookup failed'));
  }

  const createdFolder = await drive.files.create({
    requestBody: {
      name: DRIVE_BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root'],
    },
    fields: 'id, webViewLink',
  });

  if (!createdFolder.data.id) {
    throw new Error('Failed to create Drive backup folder');
  }

  return createdFolder.data.id;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildBaseUrl = (req?: express.Request) => {
  const originHeader = req?.get("origin");
  if (originHeader) {
    return originHeader;
  }

  const forwardedProto = req?.get("x-forwarded-proto");
  const forwardedHost = req?.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (req) {
    return `${req.protocol}://${req.get("host")}`;
  }

  return process.env.APP_URL || "http://localhost:3000";
};

const buildRedirectUri = (req?: express.Request) => {
  if (process.env.GOOGLE_REDIRECT_URI && !req) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  return `${buildBaseUrl(req)}/auth/google/callback`;
};

const createOAuthClient = (req?: express.Request) => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID || "placeholder_id",
  process.env.GOOGLE_CLIENT_SECRET || "placeholder_secret",
  buildRedirectUri(req)
);

// Initialize SQLite Database
let db: Database.Database;
try {
  db = new Database("oficina.db");
  console.log("[DB] SQLite Database initialized successfully");
} catch (error) {
  console.error("[DB] Failed to initialize SQLite Database:", error);
  // Fallback to in-memory if file fails
  db = new Database(":memory:");
  console.log("[DB] Falling back to in-memory database");
}

// Create tables if they don't exist
db.exec(`
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS veiculos (
    id TEXT PRIMARY KEY,
    uid TEXT,
    clienteId TEXT,
    marca TEXT,
    modelo TEXT,
    placa TEXT,
    placa_serie TEXT,
    ano TEXT,
    cor TEXT,
    chassi TEXT,
    km TEXT,
    tipo TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ordens_servico (
    id TEXT PRIMARY KEY,
    uid TEXT,
    numero TEXT,
    clienteId TEXT,
    veiculoId TEXT,
    status TEXT,
    tecnicoResponsavel TEXT,
    descricao TEXT,
    problemaRelatado TEXT,
    diagnostico TEXT,
    quilometragemInicial TEXT,
    quilometragemFinal TEXT,
    previsaoEntrega TEXT,
    dataAbertura TEXT,
    dataFinalizacao TEXT,
    dataEntrada TEXT,
    dataSaida TEXT,
    servicos TEXT, -- JSON string
    pecas TEXT, -- JSON string
    fotos TEXT, -- JSON string
    valorTotal REAL,
    observacoes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orcamentos (
    id TEXT PRIMARY KEY,
    uid TEXT,
    numero TEXT,
    clienteId TEXT,
    veiculoId TEXT,
    status TEXT,
    tecnicoResponsavel TEXT,
    descricao TEXT,
    validade TEXT,
    quilometragemInicial TEXT,
    quilometragemFinal TEXT,
    servicos TEXT, -- JSON string
    pecas TEXT, -- JSON string
    fotos TEXT, -- JSON string
    valorTotal REAL,
    observacoes TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id TEXT PRIMARY KEY,
    uid TEXT,
    clienteId TEXT,
    veiculoId TEXT,
    data TEXT,
    hora TEXT,
    servico TEXT,
    descricao TEXT,
    local TEXT,
    status TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    uid TEXT,
    nome TEXT,
    email TEXT,
    role TEXT,
    senha TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
`);

// Helper to add missing columns to existing tables
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    // Column likely already exists
  }
};

// Ensure all columns exist (for existing databases)
addColumn("usuarios", "senha", "TEXT");

// Ensure all columns exist (for existing databases)
addColumn("clientes", "inscricao_estadual", "TEXT");
addColumn("clientes", "inscricao_municipal", "TEXT");
addColumn("clientes", "logradouro", "TEXT");
addColumn("clientes", "numero", "TEXT");
addColumn("clientes", "complemento", "TEXT");
addColumn("clientes", "bairro", "TEXT");

addColumn("configuracoes", "validadePadraoOrcamento", "INTEGER");
addColumn("configuracoes", "tecnicoPadrao", "TEXT");
addColumn("configuracoes", "exibirLogoNoPdf", "INTEGER");
addColumn("configuracoes", "exibirFotosNoPdf", "INTEGER");

addColumn("veiculos", "placa_serie", "TEXT");
addColumn("veiculos", "tipo", "TEXT");
addColumn("veiculos", "clienteNome", "TEXT");

addColumn("ordens_servico", "tecnicoResponsavel", "TEXT");
addColumn("ordens_servico", "descricao", "TEXT");
addColumn("ordens_servico", "fotos", "TEXT");
addColumn("ordens_servico", "quilometragemInicial", "TEXT");
addColumn("ordens_servico", "quilometragemFinal", "TEXT");
addColumn("ordens_servico", "previsaoEntrega", "TEXT");
addColumn("ordens_servico", "dataAbertura", "TEXT");
addColumn("ordens_servico", "dataFinalizacao", "TEXT");
addColumn("ordens_servico", "clienteNome", "TEXT");

addColumn("orcamentos", "tecnicoResponsavel", "TEXT");
addColumn("orcamentos", "descricao", "TEXT");
addColumn("orcamentos", "fotos", "TEXT");
addColumn("orcamentos", "quilometragemInicial", "TEXT");
addColumn("orcamentos", "quilometragemFinal", "TEXT");
addColumn("orcamentos", "validade", "TEXT");
addColumn("orcamentos", "pecas", "TEXT");
addColumn("orcamentos", "clienteNome", "TEXT");

addColumn("agendamentos", "veiculoId", "TEXT");
addColumn("agendamentos", "osId", "TEXT");
addColumn("agendamentos", "clienteNome", "TEXT");
addColumn("agendamentos", "hora", "TEXT");
addColumn("agendamentos", "status", "TEXT");
addColumn("agendamentos", "servico", "TEXT");

async function startServer() {
  console.log("[SERVER] Starting server...");
  const app = express();
  app.set("trust proxy", true);
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Serve static files from public directory
  app.use(express.static(path.resolve(__dirname, "public"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".wasm")) {
        res.setHeader("Content-Type", "application/wasm");
        res.setHeader("X-Content-Type-Options", "nosniff");
      }
    }
  }));

  app.get("/api/auth/check-initial", (req, res) => {
    try {
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM usuarios WHERE senha IS NOT NULL`);
      const { count } = countStmt.get() as { count: number };
      res.json({ hasUsers: count > 0 });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/google/config", (req, res) => {
    const redirectUri = buildRedirectUri(req);
    const appUrl = buildBaseUrl(req);

    res.json({
      configured: hasGoogleOAuthConfig,
      redirectUri,
      appUrl,
    });
  });

  app.get("/api/user-role/:email", (req, res) => {
    const { email } = req.params;
    try {
      const stmt = db.prepare(`SELECT role FROM usuarios WHERE email = ?`);
      const row = stmt.get(email) as { role: string } | undefined;
      
      if (row) {
        res.json({ role: row.role });
      } else {
        // If no users exist, the first one is adm
        const countStmt = db.prepare(`SELECT COUNT(*) as count FROM usuarios`);
        const { count } = countStmt.get() as { count: number };
        if (count === 0) {
          res.json({ role: 'adm' });
        } else {
          res.json({ role: null });
        }
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, senha } = req.body;
    try {
      const stmt = db.prepare(`SELECT * FROM usuarios WHERE email = ?`);
      const user = stmt.get(email) as any;

      if (!user || !user.senha) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      const isValid = await bcrypt.compare(senha, user.senha);
      if (!isValid) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      // Return user info (excluding password)
      const { senha: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // SQLite CRUD Endpoints
  app.get("/api/db/:collection", (req, res) => {
    const { collection } = req.params;
    const { uid } = req.query;
    
    try {
      let stmt;
      if (collection === 'usuarios') {
        stmt = db.prepare(`SELECT * FROM ${collection} ORDER BY createdAt DESC`);
        stmt = stmt.all();
      } else {
        stmt = db.prepare(`SELECT * FROM ${collection} WHERE uid = ? ORDER BY createdAt DESC`);
        stmt = stmt.all(uid);
      }
      const rows = stmt;
      
      // Parse JSON fields
      const parsedRows = rows.map((row: any) => {
        const newRow = { ...row };
        if (newRow.servicos) newRow.servicos = JSON.parse(newRow.servicos);
        if (newRow.pecas) newRow.pecas = JSON.parse(newRow.pecas);
        if (newRow.fotos) newRow.fotos = JSON.parse(newRow.fotos);
        return newRow;
      });
      
      res.json(parsedRows);
    } catch (error) {
      console.error(`Error fetching from ${collection}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/db/:collection", async (req, res) => {
    const { collection } = req.params;
    const data = req.body;
    
    try {
      // Get table info to filter out extra fields
      const tableInfo = db.prepare(`PRAGMA table_info(${collection})`).all();
      const validColumns = tableInfo.map((col: any) => col.name);
      
      const filteredData: any = {};
      Object.keys(data).forEach(key => {
        if (validColumns.includes(key)) {
          filteredData[key] = data[key];
        }
      });

      // Special handling for user passwords
      if (collection === 'usuarios' && filteredData.senha) {
        filteredData.senha = await bcrypt.hash(filteredData.senha, 10);
      }

      if (collection === 'usuarios' && filteredData.email) {
        // Check if user already exists with this email but no password
        const existing = db.prepare(`SELECT id FROM usuarios WHERE email = ?`).get(filteredData.email) as any;
        if (existing) {
          const columns = Object.keys(filteredData).filter(k => k !== 'id');
          const values = columns.map(k => 
            (typeof filteredData[k] === 'object' && filteredData[k] !== null) ? JSON.stringify(filteredData[k]) : filteredData[k]
          );
          const setClause = columns.map(col => `${col} = ?`).join(', ');
          const stmt = db.prepare(`UPDATE usuarios SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
          stmt.run(...values, existing.id);
          return res.json({ success: true });
        }
      }

      const columns = Object.keys(filteredData);
      const values = Object.values(filteredData).map(val => {
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
      });
      
      const placeholders = columns.map(() => '?').join(', ');
      const stmt = db.prepare(`INSERT INTO ${collection} (${columns.join(', ')}) VALUES (${placeholders})`);
      stmt.run(...values);
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Error inserting into ${collection}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  app.put("/api/db/:collection/:id", async (req, res) => {
    const { collection, id } = req.params;
    const data = req.body;
    
    try {
      // Get table info to filter out extra fields
      const tableInfo = db.prepare(`PRAGMA table_info(${collection})`).all();
      const validColumns = tableInfo.map((col: any) => col.name);
      
      const filteredData: any = {};
      Object.keys(data).forEach(key => {
        if (validColumns.includes(key) && key !== 'id') {
          filteredData[key] = data[key];
        }
      });

      // Special handling for user passwords
      if (collection === 'usuarios') {
        if (filteredData.senha && filteredData.senha.trim() !== '') {
          filteredData.senha = await bcrypt.hash(filteredData.senha, 10);
        } else {
          // If password is empty or not provided, don't update it
          delete filteredData.senha;
        }
      }

      const columns = Object.keys(filteredData);
      const values = Object.values(filteredData).map(val => {
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return val;
      });
      
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const stmt = db.prepare(`UPDATE ${collection} SET ${setClause}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`);
      stmt.run(...values, id);
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Error updating ${collection}:`, error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  app.delete("/api/db/:collection/:id", (req, res) => {
    const { collection, id } = req.params;
    
    try {
      const stmt = db.prepare(`DELETE FROM ${collection} WHERE id = ?`);
      stmt.run(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting from ${collection}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Google OAuth Endpoints
  app.get("/api/auth/google/url", (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({
        error: 'OAuth do Google não configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no ambiente do servidor.',
      });
    }

    try {
      const oauth2Client = createOAuthClient(req);
      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/userinfo.email"
        ],
        prompt: "consent"
      });
      res.json({ url });
    } catch (error) {
      console.error("Error generating Google Auth URL:", error);
      res.status(500).json({ error: "Failed to generate authentication URL" });
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).send('Google OAuth is not configured');
    }

    const { code } = req.query;
    try {
      const oauth2Client = createOAuthClient(req);
      const { tokens } = await oauth2Client.getToken(code as string);
      
      // Set tokens in a cookie for mobile/WebView fallback
      res.cookie('google_tokens_temp', JSON.stringify(tokens), {
        maxAge: 300000, // 5 minutes
        httpOnly: false, // Allow client-side access
        sameSite: 'lax'
      });

      res.send(`
        <html>
          <head>
            <title>Autenticação Google</title>
            <style>
              body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
              .card { background: white; padding: 2rem; border-radius: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; max-width: 400px; }
              .btn { background: #2563eb; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-top: 1rem; }
              .btn:hover { background: #1d4ed8; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Autenticação Concluída</h2>
              <p>Sua conta Google foi conectada com sucesso ao sistema.</p>
              <p>Esta janela deve fechar automaticamente em instantes.</p>
              <button class="btn" onclick="window.close()">Fechar Janela</button>
            </div>
            <script>
              const tokens = ${JSON.stringify(tokens)};
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', tokens: tokens }, '*');
                setTimeout(() => window.close(), 1000);
              } else {
                // If not in a popup (mobile fallback), redirect back to config
                setTimeout(() => { 
                  window.location.href = '/configuracoes?google_auth=success'; 
                }, 1500);
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Google Auth error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.post("/api/auth/google/userinfo", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({ error: 'OAuth do Google não configurado no servidor.' });
    }

    const { tokens } = req.body;
    try {
      const oauth2Client = createOAuthClient(req);
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      res.json(userInfo.data);
    } catch (error) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ error: "Failed to fetch user info" });
    }
  });

  // Google API Endpoints
  app.post("/api/google/gmail/send", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({ error: 'OAuth do Google não configurado no servidor.' });
    }

    const { tokens, to, subject, body, attachments } = req.body;
    try {
      const oauth2Client = createOAuthClient(req);
      oauth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      
      let rawMessage = "";

      if (attachments && attachments.length > 0) {
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        
        const messageParts = [
          `To: ${to}`,
          `Subject: ${utf8Subject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(body).toString('base64'),
          ''
        ];

        for (const attachment of attachments) {
          messageParts.push(`--${boundary}`);
          messageParts.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
          messageParts.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
          messageParts.push('Content-Transfer-Encoding: base64');
          messageParts.push('');
          messageParts.push(attachment.content);
          messageParts.push('');
        }

        messageParts.push(`--${boundary}--`);
        rawMessage = messageParts.join('\r\n');
      } else {
        const messageParts = [
          `To: ${to}`,
          `Subject: ${utf8Subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(body).toString('base64'),
        ];
        rawMessage = messageParts.join('\r\n');
      }

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Gmail send error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/google/drive/backup", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({ error: 'OAuth do Google não configurado no servidor.' });
    }

    const { tokens, data, filename } = req.body;
    try {
      const oauth2Client = createOAuthClient(req);
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const backupFolderId = await ensureDriveBackupFolder(drive);
      const backupFileName = filename || `backup_agrotec_${new Date().toISOString()}.json`;

      const fileMetadata = {
        name: backupFileName,
        appProperties: {
          app: 'oficina-agricola-lite',
          type: 'backup',
        },
        parents: [backupFolderId]
      };
      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(data, null, 2)
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, createdTime'
      });

      const allBackupFiles = await listAllBackupFiles(drive);
      const folderBackups = allBackupFiles.filter((file) => file.parents?.includes(backupFolderId));
      const oldBackups = folderBackups.slice(DRIVE_BACKUP_KEEP_LATEST);
      await Promise.all(
        oldBackups
          .filter((file) => file.id)
          .map((file) => drive.files.delete({ fileId: file.id! }))
      );

      res.json({
        success: true,
        fileId: response.data.id,
        folderId: backupFolderId,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        deletedCount: oldBackups.length,
        keptCount: DRIVE_BACKUP_KEEP_LATEST,
      });
    } catch (error) {
      const errorMessage = getGoogleApiErrorMessage(error, 'Failed to upload to Drive');
      console.error("Drive backup error:", errorMessage, error);
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/google/drive/backups/list", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({ error: 'OAuth do Google não configurado no servidor.' });
    }

    const { tokens } = req.body;

    try {
      const oauth2Client = createOAuthClient(req);
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const backupFolderId = await ensureDriveBackupFolder(drive);

      const files = await listAllBackupFiles(drive);

      res.json({ files, folderId: backupFolderId, folderName: DRIVE_BACKUP_FOLDER_NAME, folderUrl: buildDriveFolderUrl(backupFolderId) });
    } catch (error) {
      const errorMessage = getGoogleApiErrorMessage(error, 'Failed to list backups from Drive');
      console.error('Drive backup list error:', errorMessage, error);
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/google/drive/folder/ensure", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({ error: 'OAuth do Google não configurado no servidor.' });
    }

    const { tokens } = req.body;

    try {
      const oauth2Client = createOAuthClient(req);
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const folderId = await ensureDriveBackupFolder(drive);

      res.json({
        folderId,
        folderName: DRIVE_BACKUP_FOLDER_NAME,
        folderUrl: buildDriveFolderUrl(folderId),
      });
    } catch (error) {
      const errorMessage = getGoogleApiErrorMessage(error, 'Failed to ensure Drive backup folder');
      console.error('Drive folder ensure error:', errorMessage, error);
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post("/api/google/drive/backups/download", async (req, res) => {
    if (!hasGoogleOAuthConfig) {
      return res.status(503).json({ error: 'OAuth do Google não configurado no servidor.' });
    }

    const { tokens, fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'fileId é obrigatório.' });
    }

    try {
      const oauth2Client = createOAuthClient(req);
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const metadata = await drive.files.get({
        fileId,
        fields: 'id, name',
      });

      const response = await drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        {
          responseType: 'text',
        }
      );

      let content = String(response.data ?? '');
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'string') {
          content = parsed;
        }
      } catch {
        // Keep raw string content.
      }

      res.json({
        fileId,
        filename: metadata.data.name,
        content,
      });
    } catch (error) {
      console.error('Drive backup download error:', error);
      res.status(500).json({ error: 'Failed to download backup from Drive' });
    }
  });

  // Vite middleware for development must come after API routes so /api/* is not
  // swallowed by the SPA fallback during local development.
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  // Production static files
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
