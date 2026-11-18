import { Platform } from 'react-native';

/** baixar arquivos gerados pelo app (ex.: relatório em pdf). por enquanto, só no navegador. */
export const downloadSupported = Platform.OS === 'web';

export function downloadFile(bytes: Uint8Array, fileName: string, mime: string): void {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) throw new Error('download indisponível');
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = doc.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
