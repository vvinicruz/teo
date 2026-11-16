import { Platform } from 'react-native';
import { buildLines } from '../domain/pdfLayout';

/**
 * extrai o texto de um pdf, linha por linha, usando o pdf.js (mozilla) hospedado no próprio
 * site do teo (public/vendor/pdfjs). tudo roda no navegador: o arquivo não é enviado.
 */

interface PdfTextItem {
  str: string;
  transform: number[];
  /** largura do trecho, na mesma unidade da posição. */
  width: number;
}
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: PdfTextItem[] }> }>;
    }>;
  };
}

let loading: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (loading) return loading;
  loading = new Promise<PdfJs>((resolve, reject) => {
    const w = globalThis as unknown as { pdfjsLib?: PdfJs; document?: Document };
    if (w.pdfjsLib) return resolve(w.pdfjsLib);
    const script = w.document!.createElement('script');
    script.src = '/vendor/pdfjs/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (!w.pdfjsLib) return reject(new Error('pdf.js não carregou'));
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
      resolve(w.pdfjsLib);
    };
    script.onerror = () => reject(new Error('pdf.js não carregou'));
    w.document!.head.appendChild(script);
  });
  loading.catch(() => (loading = null));
  return loading;
}

export const pdfSupported = Platform.OS === 'web';

export function isPdf(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

/**
 * devolve as linhas de texto do pdf. itens na mesma altura viram uma linha, em ordem da
 * esquerda para a direita (duas colunas da fatura ficam na mesma linha; o leitor separa
 * cada compra pelo padrão "data descrição valor").
 */
export async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    out.push(
      ...buildLines(
        items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, size: Math.abs(it.transform[0]) || 10 })),
      ),
    );
  }
  return out;
}
