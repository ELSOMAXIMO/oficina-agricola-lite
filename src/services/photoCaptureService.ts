import { Camera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';

const blobToDataUrl = (blob: Blob) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Falha ao converter imagem para base64.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler imagem.'));
    reader.readAsDataURL(blob);
  });
};

const webPathToDataUrl = async (webPath?: string) => {
  if (!webPath) {
    throw new Error('Imagem sem caminho válido para leitura.');
  }

  const response = await fetch(webPath);
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const isUserCancellationError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('cancel') || message.includes('user cancelled');
};

export const photoCaptureService = {
  isUserCancellationError,

  async takePhoto() {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      direction: CameraDirection.Rear,
      correctOrientation: true,
      saveToGallery: false,
      webUseInput: false,
    });

    if (photo.dataUrl) {
      return photo.dataUrl;
    }

    if (photo.webPath) {
      return webPathToDataUrl(photo.webPath);
    }

    throw new Error('A câmera não retornou uma imagem válida.');
  },

  async pickPhotos() {
    const galleryPhotos = await Camera.pickImages({
      quality: 80,
      limit: 10,
    });

    const photos = await Promise.all(
      (galleryPhotos.photos || []).map((photo) => webPathToDataUrl(photo.webPath))
    );

    return photos;
  }
};
