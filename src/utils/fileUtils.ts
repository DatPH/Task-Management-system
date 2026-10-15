import type { CommentAttachment } from '../types';

export const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (2,097,152 bytes)

/**
 * Formats byte size into human-readable B / KB / MB
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Checks if a file is an image based on MIME type or extension
 */
export const isImageFile = (mimeType: string, filename?: string): boolean => {
  if (mimeType && mimeType.startsWith('image/')) {
    return true;
  }
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext || '');
  }
  return false;
};

export type FileCategory =
  | 'image'
  | 'pdf'
  | 'document'
  | 'spreadsheet'
  | 'code'
  | 'archive'
  | 'audio'
  | 'video'
  | 'generic';

/**
 * Returns a file category for styling and icon representation
 */
export const getFileCategory = (mimeType: string, filename?: string): FileCategory => {
  if (isImageFile(mimeType, filename)) return 'image';

  const ext = (filename?.split('.').pop() || '').toLowerCase();

  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }

  if (
    mimeType.includes('word') ||
    mimeType.includes('officedocument.wordprocessingml') ||
    ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)
  ) {
    return 'document';
  }

  if (
    mimeType.includes('excel') ||
    mimeType.includes('officedocument.spreadsheetml') ||
    ['xls', 'xlsx', 'csv', 'tsv'].includes(ext)
  ) {
    return 'spreadsheet';
  }

  if (
    ['json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'py', 'sql', 'sh', 'yaml', 'yml'].includes(ext)
  ) {
    return 'code';
  }

  if (
    mimeType.includes('zip') ||
    mimeType.includes('compressed') ||
    mimeType.includes('tar') ||
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)
  ) {
    return 'archive';
  }

  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  }

  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }

  return 'generic';
};

/**
 * Reads browser File as Base64 Data URL
 */
export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as Data URL'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
};

/**
 * Triggers browser download of an attachment
 */
export const downloadAttachment = (attachment: { name: string; url: string }) => {
  try {
    const anchor = document.createElement('a');
    anchor.href = attachment.url;
    anchor.download = attachment.name || 'attachment';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch (err) {
    console.error('Failed to download attachment', err);
    window.open(attachment.url, '_blank');
  }
};
