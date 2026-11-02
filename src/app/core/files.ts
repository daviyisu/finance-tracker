/**
 * Entrega un archivo al usuario: en el móvil abre el menú de compartir
 * (guardar en Archivos, iCloud, enviar...); si no se puede, lo descarga.
 * Lanza AbortError si el usuario cierra el menú sin elegir nada.
 */
export async function saveFile(file: File, title: string): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      // Safari lo rechaza si ha pasado demasiado tiempo desde el toque: se descarga en su lugar.
      if ((error as DOMException)?.name !== 'NotAllowedError') throw error;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isAbort(error: unknown): boolean {
  return (error as DOMException)?.name === 'AbortError';
}
