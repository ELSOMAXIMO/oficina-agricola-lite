import { jsPDF } from 'jspdf';
import { sqlDbService } from './sqlDbService';

interface SaveGeneratedPdfParams {
  uid: string;
  recordType: 'ordem_servico' | 'orcamento' | 'relatorio';
  recordId: string;
  fileName: string;
  doc: jsPDF;
}

const buildArchiveId = (uid: string, recordType: SaveGeneratedPdfParams['recordType'], recordId: string) => {
  return `pdf:${uid}:${recordType}:${recordId}`;
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

export const pdfArchiveService = {
  async saveGeneratedPdf({ uid, recordType, recordId, fileName, doc }: SaveGeneratedPdfParams) {
    const id = buildArchiveId(uid, recordType, recordId);
    const now = new Date().toISOString();
    const base64Content = arrayBufferToBase64(doc.output('arraybuffer'));

    await sqlDbService.run(
      `
        INSERT OR REPLACE INTO documentos_pdf (
          id,
          uid,
          recordType,
          recordId,
          fileName,
          mimeType,
          base64Content,
          createdAt,
          updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM documentos_pdf WHERE id = ?), ?), ?)
      `,
      [
        id,
        uid,
        recordType,
        recordId,
        fileName,
        'application/pdf',
        base64Content,
        id,
        now,
        now,
      ]
    );
  }
};
