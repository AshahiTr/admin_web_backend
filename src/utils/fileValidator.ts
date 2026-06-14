export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/svg+xml'],
  documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  data: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
};

export const ALLOWED_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.svg'],
  documents: ['.pdf', '.doc', '.docx'],
  data: ['.csv', '.xls', '.xlsx']
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const validateFileType = (mimetype: string, filename: string, category: 'avatar' | 'document' | 'logo' | 'data'): FileValidationResult => {
  let allowedMimeTypes: string[] = [];
  let allowedExtensions: string[] = [];

  switch (category) {
    case 'avatar':
    case 'logo':
      allowedMimeTypes = ALLOWED_MIME_TYPES.images;
      allowedExtensions = ALLOWED_EXTENSIONS.images;
      break;
    case 'document':
      allowedMimeTypes = [...ALLOWED_MIME_TYPES.images, ...ALLOWED_MIME_TYPES.documents];
      allowedExtensions = [...ALLOWED_EXTENSIONS.images, ...ALLOWED_EXTENSIONS.documents];
      break;
    case 'data':
      allowedMimeTypes = ALLOWED_MIME_TYPES.data;
      allowedExtensions = ALLOWED_EXTENSIONS.data;
      break;
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(mimetype)) {
    return { valid: false, error: `MIME type không được phép: ${mimetype}` };
  }

  // Check file extension
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (!allowedExtensions.includes(extension)) {
    return { valid: false, error: `Extension không được phép: ${extension}` };
  }

  return { valid: true };
};

export const validateFileSize = (size: number): FileValidationResult => {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `Kích thước file vượt quá giới hạn ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  return { valid: true };
};

export const sanitizeFilename = (filename: string): string => {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_');
};

export const generateUniqueFilename = (originalName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const name = sanitizeFilename(originalName.substring(0, originalName.lastIndexOf('.')));
  return `${name}_${timestamp}_${random}${extension}`;
};
