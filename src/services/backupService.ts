import CryptoJS from 'crypto-js';
import { sqlDbService } from './sqlDbService';
import { googleService, GoogleTokens } from './googleService';
import { toast } from 'react-hot-toast';
import { buildApiUrl } from '../utils/api';

const BACKUP_SECRET = 'automecanica-backup-secret-key'; // In a real app, this should be a user-defined password
const BACKUP_FILENAME_PREFIX = 'backup_oficina';

const buildBackupFileName = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${BACKUP_FILENAME_PREFIX}_${timestamp}.enc`;
};

const parseServerResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
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

export const backupService = {
  async exportDatabase() {
    try {
      const db = await sqlDbService.init();
      const data = db.export(); // Uint8Array
      
      // Convert Uint8Array to WordArray for CryptoJS
      const wordArray = CryptoJS.lib.WordArray.create(data as any);
      const encrypted = CryptoJS.AES.encrypt(wordArray, BACKUP_SECRET).toString();
      
      return {
        filename: buildBackupFileName(),
        content: encrypted,
        mimeType: 'application/octet-stream'
      };
    } catch (error) {
      console.error('Erro ao exportar banco de dados:', error);
      throw error;
    }
  },

  async sendBackupByEmail(email: string, tokens: any) {
    try {
      const backup = await this.exportDatabase();
      
      await googleService.sendEmail(tokens, {
        to: email,
        subject: 'Backup do Sistema Auto Mecânica',
        body: '<p>Segue em anexo o backup criptografado do sistema.</p>',
        attachments: [
          {
            filename: backup.filename,
            content: backup.content,
            mimeType: backup.mimeType
          }
        ]
      });
      
      toast.success('Backup enviado por e-mail com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar backup por e-mail:', error);
      toast.error('Falha ao enviar backup por e-mail.');
      throw error;
    }
  },

  async uploadBackupToDrive(tokens: any) {
    try {
      await googleService.ensureDriveBackupFolder(tokens);
      const backup = await this.exportDatabase();
      
      // For Drive, we might want to send the raw JSON or the encrypted string
      // The server endpoint /api/google/drive/backup expects a JSON object
      // Let's adapt it or send the encrypted string as content
      
      const response = await fetch(buildApiUrl('/api/google/drive/backup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          data: backup.content,
          filename: backup.filename
        })
      });

      if (!response.ok) {
        const error = await parseServerResponse<{ error?: string }>(response, `Erro do servidor: ${response.status}`);
        const errorMessage = error.error || `Erro do servidor: ${response.status}`;
        console.error('Drive backup error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await parseServerResponse<{ deletedCount?: number }>(response, 'Resposta inválida do servidor ao salvar backup no Drive');
      const deletedCount = Number(result.deletedCount || 0);
      
      toast.success(
        deletedCount > 0
          ? `Backup salvo no Google Drive. ${deletedCount} backup(s) antigo(s) removido(s).`
          : 'Backup salvo no Google Drive com sucesso!'
      );
    } catch (error) {
      console.error('Erro ao salvar backup no Drive:', error);
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar backup no Google Drive.');
      throw error;
    }
  },

  async importDatabase(encryptedContent: string) {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedContent, BACKUP_SECRET);
      const typedArray = this.wordArrayToUint8Array(decrypted);
      
      // Save to localforage and re-init DB
      await sqlDbService.import(typedArray);
      toast.success('Banco de dados restaurado com sucesso!');
      window.location.reload();
    } catch (error) {
      console.error('Erro ao importar banco de dados:', error);
      toast.error('Falha ao restaurar backup. Verifique o arquivo e a senha.');
      throw error;
    }
  },

  async listDriveBackups(tokens?: GoogleTokens | null) {
    return googleService.listDriveBackups(tokens);
  },

  async ensureDriveBackupFolder(tokens?: GoogleTokens | null) {
    return googleService.ensureDriveBackupFolder(tokens);
  },

  async restoreFromDrive(fileId: string, tokens?: GoogleTokens | null) {
    const backup = await googleService.downloadDriveBackup(fileId, tokens);
    await this.importDatabase(backup.content);
    return backup;
  },

  // Helper to convert WordArray back to Uint8Array
  wordArrayToUint8Array(wordArray: any) {
    const l = wordArray.sigBytes;
    const words = wordArray.words;
    const result = new Uint8Array(l);
    for (let i = 0; i < l; i++) {
      result[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return result;
  }
};
