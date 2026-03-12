import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capacitor-community/file-opener';
import { jsPDF } from 'jspdf';

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

export const pdfOpenService = {
  async openPdf(doc: jsPDF, fileName: string) {
    const blob = doc.output('blob');

    if (!Capacitor.isNativePlatform()) {
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');

      if (!win || win.closed || typeof win.closed === 'undefined') {
        doc.save(fileName);
      }

      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    const base64Data = arrayBufferToBase64(doc.output('arraybuffer'));
    const savedFile = await Filesystem.writeFile({
      path: `pdf/${fileName}`,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    try {
      await FileOpener.open({
        filePath: savedFile.uri,
        contentType: 'application/pdf',
        openWithDefault: true,
      });
      return;
    } catch {
      await Share.share({
        title: fileName,
        text: fileName,
        url: savedFile.uri,
        dialogTitle: 'Abrir PDF',
      });
    }
  }
};
