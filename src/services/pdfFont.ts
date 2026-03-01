import { jsPDF } from 'jspdf';

const PDF_CJK_FONT_URL = '/fonts/simhei.ttf';
const PDF_CJK_FONT_FILE = 'simhei.ttf';
export const PDF_CJK_FONT_FAMILY = 'simhei';

let cachedFontBase64Promise: Promise<string | null> | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...Array.from(chunk));
  }

  return btoa(binary);
};

const getCjkFontBase64 = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  if (!cachedFontBase64Promise) {
    cachedFontBase64Promise = fetch(PDF_CJK_FONT_URL)
      .then(async (res) => {
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        return arrayBufferToBase64(buffer);
      })
      .catch(() => null);
  }

  return cachedFontBase64Promise;
};

export const ensurePdfCjkFont = async (pdf: jsPDF): Promise<boolean> => {
  const base64 = await getCjkFontBase64();
  if (!base64) return false;

  try {
    const fontList = pdf.getFontList() as Record<string, string[]>;
    const hasNormal = Array.isArray(fontList[PDF_CJK_FONT_FAMILY]) &&
      fontList[PDF_CJK_FONT_FAMILY].includes('normal');
    const hasBold = Array.isArray(fontList[PDF_CJK_FONT_FAMILY]) &&
      fontList[PDF_CJK_FONT_FAMILY].includes('bold');

    if (!hasNormal || !hasBold) {
      pdf.addFileToVFS(PDF_CJK_FONT_FILE, base64);
      pdf.addFont(PDF_CJK_FONT_FILE, PDF_CJK_FONT_FAMILY, 'normal');
      pdf.addFont(PDF_CJK_FONT_FILE, PDF_CJK_FONT_FAMILY, 'bold');
    }

    return true;
  } catch (error) {
    console.warn('Failed to register CJK font for PDF export', error);
    return false;
  }
};

