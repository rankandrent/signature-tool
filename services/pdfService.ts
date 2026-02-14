
import { PDFDocument } from 'pdf-lib';
import { SignatureSettings } from '../types';

/**
 * Converts an image buffer to a grayscale, high-contrast version for a "black stamp" look.
 */
async function processImageToGrayscale(arrayBuffer: ArrayBuffer, mimeType: string): Promise<ArrayBuffer> {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');

  // Apply filters to make it look like a clean black/white stamp
  // Grayscale to remove color, contrast to make blacks deeper and whites disappear
  ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
  ctx.drawImage(img, 0, 0);
  
  const processedBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType);
  });
  
  URL.revokeObjectURL(url);
  return await processedBlob.arrayBuffer();
}

export const addSignatureToPdf = async (
  pdfArrayBuffer: ArrayBuffer,
  signatureArrayBuffer: ArrayBuffer,
  signatureType: string,
  settings: SignatureSettings
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
  
  let finalSignatureBuffer = signatureArrayBuffer;
  if (settings.isGrayscale) {
    finalSignatureBuffer = await processImageToGrayscale(signatureArrayBuffer, signatureType);
  }

  let signatureImage;
  if (signatureType === 'image/png') {
    signatureImage = await pdfDoc.embedPng(finalSignatureBuffer);
  } else if (signatureType === 'image/jpeg' || signatureType === 'image/jpg') {
    signatureImage = await pdfDoc.embedJpg(finalSignatureBuffer);
  } else {
    throw new Error('Unsupported image format. Please use PNG or JPG.');
  }

  const pages = pdfDoc.getPages();
  const { width, height } = signatureImage.scale(settings.scale / 100);

  let targetIndices: number[] = [];
  if (settings.mode === 'all') {
    targetIndices = pages.map((_, i) => i);
  } else if (settings.mode === 'last') {
    targetIndices = [pages.length - 1];
  } else if (settings.mode === 'custom') {
    targetIndices = settings.selectedPages;
  }

  targetIndices.forEach((index) => {
    if (index >= 0 && index < pages.length) {
      const page = pages[index];
      const pos = settings.pagePositions[index] || { x: settings.globalX, y: settings.globalY };
      
      page.drawImage(signatureImage, {
        x: pos.x,
        y: pos.y,
        width,
        height,
        opacity: settings.opacity,
      });
    }
  });

  return await pdfDoc.save();
};
