
import { PDFDocument } from 'pdf-lib';
import { SignatureSettings } from '../types';

export const addSignatureToPdf = async (
  pdfArrayBuffer: ArrayBuffer,
  signatureArrayBuffer: ArrayBuffer,
  signatureType: string,
  settings: SignatureSettings
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
  let signatureImage;

  if (signatureType === 'image/png') {
    signatureImage = await pdfDoc.embedPng(signatureArrayBuffer);
  } else if (signatureType === 'image/jpeg' || signatureType === 'image/jpg') {
    signatureImage = await pdfDoc.embedJpg(signatureArrayBuffer);
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
      page.drawImage(signatureImage, {
        x: settings.x,
        y: settings.y,
        width,
        height,
        opacity: settings.opacity,
      });
    }
  });

  return await pdfDoc.save();
};
