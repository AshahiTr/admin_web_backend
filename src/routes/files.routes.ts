import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { FileMetadata } from '../models/mongoose.models';
import { validateFileType, validateFileSize, generateUniqueFilename } from '../utils/fileValidator';
import { uploadFileToGridFS, downloadFileFromGridFS, deleteFileFromGridFS } from '../config/gridfs';

const router = express.Router();

// Upload file
router.post('/applications/:applicationId/upload', authenticateToken, uploadSingle, async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file nào được upload' });
    }

    const applicationId = req.params.applicationId;
    const file = req.file;

    const typeValidation = validateFileType(file.mimetype, file.originalname, 'document');
    if (!typeValidation.valid) {
      return res.status(400).json({ error: typeValidation.error });
    }

    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      return res.status(400).json({ error: sizeValidation.error });
    }

    const uniqueFilename = generateUniqueFilename(file.originalname);
    const gridFsId = await uploadFileToGridFS(file.buffer, uniqueFilename, {
      applicationId,
      uploadedBy: req.userId
    });

    const fileMetadata = await FileMetadata.create({
      gridFsId,
      originalName: file.originalname,
      filename: uniqueFilename,
      mimeType: file.mimetype,
      size: file.size,
      category: 'document',
      uploadedBy: req.userId,
      uploadedFor: {
        type: 'application',
        id: applicationId
      },
      isPublic: false
    });

    res.status(201).json({
      message: 'Upload thành công',
      file: {
        id: fileMetadata._id,
        originalName: fileMetadata.originalName,
        size: fileMetadata.size,
        uploadDate: fileMetadata.uploadDate,
        url: `/api/files/${fileMetadata._id}/download`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Lỗi khi upload file' });
  }
});

// Download file
router.get('/:fileId/download', authenticateToken, async (req: any, res) => {
  try {
    const fileMetadata = await FileMetadata.findById(req.params.fileId);
    
    if (!fileMetadata) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }

    if (!fileMetadata.isPublic && fileMetadata.uploadedBy.toString() !== req.userId) {
      const { User } = await import('../models/mongoose.models');
      const user = await User.findById(req.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền download file này' });
      }
    }

    const fileBuffer = await downloadFileFromGridFS(fileMetadata.gridFsId);
    
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileMetadata.originalName)}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Lỗi khi download file' });
  }
});

// Delete file
router.delete('/:fileId', authenticateToken, async (req: any, res) => {
  try {
    const fileMetadata = await FileMetadata.findById(req.params.fileId);
    
    if (!fileMetadata) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }

    if (fileMetadata.uploadedBy.toString() !== req.userId) {
      const { User } = await import('../models/mongoose.models');
      const user = await User.findById(req.userId);
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền xóa file này' });
      }
    }

    await deleteFileFromGridFS(fileMetadata.gridFsId);
    await FileMetadata.deleteOne({ _id: req.params.fileId });

    res.json({ message: 'Xóa file thành công' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Lỗi khi xóa file' });
  }
});

export default router;