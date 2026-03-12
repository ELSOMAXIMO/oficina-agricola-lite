import { toast } from 'react-hot-toast';
import { API_BASE_CONFIGURATION_MESSAGE, buildApiUrl } from '../utils/api';

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GoogleIntegrationConfig {
  configured: boolean;
  redirectUri: string;
  appUrl: string;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime?: string;
  size?: string;
  mimeType?: string;
}

export interface DriveBackupFolderInfo {
  folderId: string;
  folderName: string;
  folderUrl: string;
}

const TOKENS_KEY = 'google_tokens';

const parseErrorResponse = async (response: Response, fallbackMessage: string) => {
  const text = await response.text();

  if (!text) {
    return fallbackMessage;
  }

  try {
    const data = JSON.parse(text);
    return data.error || fallbackMessage;
  } catch {
    return text || fallbackMessage;
  }
};

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const text = await response.text();

  if (!text) {
    throw new Error(fallbackMessage);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
};

export const googleService = {
  getTokens(): GoogleTokens | null {
    const tokens = localStorage.getItem(TOKENS_KEY);
    if (!tokens) return null;
    return JSON.parse(tokens);
  },

  setTokens(tokens: GoogleTokens) {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  },

  removeTokens() {
    localStorage.removeItem(TOKENS_KEY);
  },

  async getAuthUrl(): Promise<string> {
    let response: Response;
    let url: string;

    try {
      url = buildApiUrl('/api/auth/google/url');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(API_BASE_CONFIGURATION_MESSAGE);
    }

    try {
      response = await fetch(url);
    } catch (error) {
      if (error instanceof Error && error.message) {
        throw error;
      }

      throw new Error('Servidor indisponível para autenticação Google. Inicie o backend antes de conectar a conta.');
    }

    if (!response.ok) {
      const message = await parseErrorResponse(response, `Erro ao obter URL de autenticação: ${response.status}`);
      console.error('Auth URL error response:', message);
      throw new Error(message);
    }

    try {
      const data = await parseJsonResponse<{ url: string }>(response, 'Resposta inválida do servidor (esperado JSON)');
      return data.url;
    } catch {
      throw new Error('Resposta inválida do servidor (esperado JSON)');
    }
  },

  async getIntegrationConfig(): Promise<GoogleIntegrationConfig> {
    let response: Response;
    let url: string;

    try {
      url = buildApiUrl('/api/google/config');
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(API_BASE_CONFIGURATION_MESSAGE);
    }

    try {
      response = await fetch(url);
    } catch (error) {
      if (error instanceof Error && error.message) {
        throw error;
      }

      throw new Error('Servidor indisponível para consultar a configuração Google.');
    }

    if (!response.ok) {
      const message = await parseErrorResponse(response, `Erro ao consultar integração Google: ${response.status}`);
      throw new Error(message);
    }

    return parseJsonResponse<GoogleIntegrationConfig>(response, 'Resposta inválida do servidor ao consultar integração Google');
  },

  async sendEmail(tokens: GoogleTokens | null, options: { to: string; subject: string; body: string; attachments?: any[] }) {
    const activeTokens = tokens || this.getTokens();
    if (!activeTokens) throw new Error('Não autenticado com o Google');

    const response = await fetch(buildApiUrl('/api/google/gmail/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tokens: activeTokens, 
        to: options.to, 
        subject: options.subject, 
        body: options.body, 
        attachments: options.attachments || [] 
      }),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response, `Erro do servidor: ${response.status}`);
      console.error('Send email error response:', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      return await parseJsonResponse<Record<string, unknown>>(response, 'Resposta inválida do servidor ao enviar e-mail');
    } catch {
      throw new Error('Resposta inválida do servidor ao enviar e-mail');
    }
  },

  async backupToDrive(data: any, filename?: string) {
    const tokens = this.getTokens();
    if (!tokens) throw new Error('Não autenticado com o Google');

    const response = await fetch(buildApiUrl('/api/google/drive/backup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, data, filename }),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorResponse(response, `Erro do servidor: ${response.status}`);
      console.error('Drive backup error response:', errorMessage);
      throw new Error(errorMessage);
    }

    try {
      return await parseJsonResponse<Record<string, unknown>>(response, 'Resposta inválida do servidor ao fazer backup');
    } catch {
      throw new Error('Resposta inválida do servidor ao fazer backup');
    }
  },

  async listDriveBackups(tokens?: GoogleTokens | null): Promise<{ files: DriveBackupFile[]; folder?: DriveBackupFolderInfo }> {
    const activeTokens = tokens || this.getTokens();
    if (!activeTokens) throw new Error('Não autenticado com o Google');

    const response = await fetch(buildApiUrl('/api/google/drive/backups/list'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: activeTokens }),
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response, 'Falha ao listar backups do Google Drive');
      throw new Error(message);
    }

    const data = await parseJsonResponse<{ files: DriveBackupFile[]; folderId?: string; folderName?: string; folderUrl?: string }>(response, 'Resposta inválida do servidor ao listar backups do Drive');
    return {
      files: data.files || [],
      folder: data.folderId && data.folderName && data.folderUrl
        ? { folderId: data.folderId, folderName: data.folderName, folderUrl: data.folderUrl }
        : undefined,
    };
  },

  async ensureDriveBackupFolder(tokens?: GoogleTokens | null): Promise<DriveBackupFolderInfo> {
    const activeTokens = tokens || this.getTokens();
    if (!activeTokens) throw new Error('Não autenticado com o Google');

    const response = await fetch(buildApiUrl('/api/google/drive/folder/ensure'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: activeTokens }),
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response, 'Falha ao preparar a pasta de backups no Google Drive');
      throw new Error(message);
    }

    return parseJsonResponse<DriveBackupFolderInfo>(response, 'Resposta inválida do servidor ao preparar a pasta de backups');
  },

  async downloadDriveBackup(fileId: string, tokens?: GoogleTokens | null): Promise<{ fileId: string; filename: string; content: string }> {
    const activeTokens = tokens || this.getTokens();
    if (!activeTokens) throw new Error('Não autenticado com o Google');

    const response = await fetch(buildApiUrl('/api/google/drive/backups/download'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: activeTokens, fileId }),
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response, 'Falha ao baixar backup do Google Drive');
      throw new Error(message);
    }

    return parseJsonResponse<{ fileId: string; filename: string; content: string }>(response, 'Resposta inválida do servidor ao baixar backup do Google Drive');
  }
};
