import multer from 'multer';
import { MAX_FILE_SIZE } from '../utils/fileValidator.js';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', 10);