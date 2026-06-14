import express, { Request, Response } from 'express';
import { authenticateToken, authorizeRole, AuthRequest } from '../middleware/auth';
import { uploadSingle } from '../middleware/upload';
import { FileMetadata } from '../models/mongoose.models';
import {
  validateFileType,
  validateFileSize,
  generateUniqueFilename
} from '../utils/fileValidator';
import {
  uploadFileToGridFS,
  downloadFileFromGridFS,
  deleteFileFromGridFS,
  getFileMetadata
} from '../config/gridfs';

const router = express.Router();

// ============= UPLOAD ENDPOINTS =============

// Upload application document
router.post(
  '/applications/:applicationId/upload',
  authenticateToken,
  uploadSingle,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const { applicationId } = req.params;

      // Validate file type
      const typeValidation = validateFileType(req.file.mimetype, req.file.originalname, 'document');
      if (!typeValidation.valid) {
        return res.status(400).json({ error: typeValidation.error });
      }

      // Validate file size
      const sizeValidation = validateFileSize(req.file.size);
      if (!sizeValidation.valid) {
        return res.status(400).json({ error: sizeValidation.error });
      }

      // Upload to GridFS
      const filename = generateUniqueFilename(req.file.originalname);
      const gridFsId = await uploadFileToGridFS(req.file.buffer, filename, {
        originalName: req.file.originalname,
        uploadedBy: req.userId,
        category: 'document'
      });

      // Save metadata
      const fileMetadata = new FileMetadata({
        gridFsId,
        originalName: req.file.originalname,
        filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: 'document',
        uploadedBy: req.userId,
        uploadedFor: {
          type: 'application',
          id: applicationId
        },
        metadata: {
          applicationId
        }
      });

      await fileMetadata.save();

      res.status(201).json({
        message: 'File upload thành công',
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
  }
);

// Upload user avatar
router.post(
  '/users/:userId/avatar',
  authenticateToken,
  uploadSingle,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const { userId } = req.params;

      // Verify user is uploading their own avatar
      if (req.userId !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền upload avatar của người dùng khác' });
      }

      // Validate file type
      const typeValidation = validateFileType(req.file.mimetype, req.file.originalname, 'avatar');
      if (!typeValidation.valid) {
        return res.status(400).json({ error: typeValidation.error });
      }

      // Validate file size
      const sizeValidation = validateFileSize(req.file.size);
      if (!sizeValidation.valid) {
        return res.status(400).json({ error: sizeValidation.error });
      }

      // Upload to GridFS
      const filename = generateUniqueFilename(req.file.originalname);
      const gridFsId = await uploadFileToGridFS(req.file.buffer, filename, {
        originalName: req.file.originalname,
        uploadedBy: req.userId,
        category: 'avatar'
      });

      // Save metadata
      const fileMetadata = new FileMetadata({
        gridFsId,
        originalName: req.file.originalname,
        filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: 'avatar',
        uploadedBy: req.userId,
        uploadedFor: {
          type: 'user',
          id: userId
        },
        isPublic: true,
        metadata: {
          userId
        }
      });

      await fileMetadata.save();

      res.status(201).json({
        message: 'Upload avatar thành công',
        file: {
          id: fileMetadata._id,
          url: `/api/files/users/${userId}/avatar`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Lỗi khi upload avatar' });
    }
  }
);

// Upload school logo
router.post(
  '/schools/:schoolId/logo',
  authenticateToken,
  authorizeRole('admin', 'manager'),
  uploadSingle,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      const { schoolId } = req.params;

      // Validate file type
      const typeValidation = validateFileType(req.file.mimetype, req.file.originalname, 'logo');
      if (!typeValidation.valid) {
        return res.status(400).json({ error: typeValidation.error });
      }

      // Validate file size
      const sizeValidation = validateFileSize(req.file.size);
      if (!sizeValidation.valid) {
        return res.status(400).json({ error: sizeValidation.error });
      }

      // Upload to GridFS
      const filename = generateUniqueFilename(req.file.originalname);
      const gridFsId = await uploadFileToGridFS(req.file.buffer, filename, {
        originalName: req.file.originalname,
        uploadedBy: req.userId,
        category: 'logo'
      });

      // Save metadata
      const fileMetadata = new FileMetadata({
        gridFsId,
        originalName: req.file.originalname,
        filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: 'logo',
        uploadedBy: req.userId,
        uploadedFor: {
          type: 'school',
          id: schoolId
        },
        isPublic: true,
        metadata: {
          schoolId
        }
      });

      await fileMetadata.save();

      res.status(201).json({
        message: 'Upload logo thành công',
        file: {
          id: fileMetadata._id,
          url: `/api/files/schools/${schoolId}/logo`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Lỗi khi upload logo' });
    }
  }
);

// Upload data file (CSV/Excel)
router.post(
  '/import/applications',
  authenticateToken,
  authorizeRole('admin', 'manager'),
  uploadSingle,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Không có file được upload' });
      }

      // Validate file type
      const typeValidation = validateFileType(req.file.mimetype, req.file.originalname, 'data');
      if (!typeValidation.valid) {
        return res.status(400).json({ error: typeValidation.error });
      }

      // Validate file size
      const sizeValidation = validateFileSize(req.file.size);
      if (!sizeValidation.valid) {
        return res.status(400).json({ error: sizeValidation.error });
      }

      // Upload to GridFS
      const filename = generateUniqueFilename(req.file.originalname);
      const gridFsId = await uploadFileToGridFS(req.file.buffer, filename, {
        originalName: req.file.originalname,
        uploadedBy: req.userId,
        category: 'data'
      });

      // Save metadata
      const fileMetadata = new FileMetadata({
        gridFsId,
        originalName: req.file.originalname,
        filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: 'data',
        uploadedBy: req.userId,
        uploadedFor: {
          type: 'application',
          id: req.userId // Uploaded by user
        },
        metadata: {
          userId: req.userId
        }
      });

      await fileMetadata.save();

      res.status(201).json({
        message: 'Upload file dữ liệu thành công',
        file: {
          id: fileMetadata._id,
          originalName: fileMetadata.originalName,
          size: fileMetadata.size,
          url: `/api/files/${fileMetadata._id}/download`
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Lỗi khi upload file' });
    }
  }
);

// ============= DOWNLOAD ENDPOINTS =============

// Download file by ID
router.get('/:fileId/download', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get file metadata
    const fileMetadata = await FileMetadata.findById(fileId);
    if (!fileMetadata) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }

    // Check permissions
    if (!fileMetadata.isPublic) {
      const isOwner = fileMetadata.uploadedBy.toString() === req.userId;
      const isAdmin = req.user?.role === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Không có quyền download file này' });
      }
    }

    // Download from GridFS
    const buffer = await downloadFileFromGridFS(fileMetadata.gridFsId);

    // Set response headers
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileMetadata.originalName}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Lỗi khi download file' });
  }
});

// Get user avatar
router.get('/users/:userId/avatar', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Find latest avatar for user
    const fileMetadata = await FileMetadata.findOne({
      category: 'avatar',
      'uploadedFor.type': 'user',
      'uploadedFor.id': userId
    }).sort({ uploadDate: -1 });

    if (!fileMetadata) {
      // Return default avatar placeholder
      return res.status(404).json({ error: 'Avatar không tồn tại' });
    }

    // Download from GridFS
    const buffer = await downloadFileFromGridFS(fileMetadata.gridFsId);

    // Set response headers
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileMetadata.originalName}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Lỗi khi tải avatar' });
  }
});

// Get school logo
router.get('/schools/:schoolId/logo', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;

    // Find logo for school
    const fileMetadata = await FileMetadata.findOne({
      category: 'logo',
      'uploadedFor.type': 'school',
      'uploadedFor.id': schoolId
    });

    if (!fileMetadata) {
      return res.status(404).json({ error: 'Logo không tồn tại' });
    }

    // Download from GridFS
    const buffer = await downloadFileFromGridFS(fileMetadata.gridFsId);

    // Set response headers
    res.setHeader('Content-Type', fileMetadata.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileMetadata.originalName}"`);
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 1 week

    res.send(buffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Lỗi khi tải logo' });
  }
});

// List files for application
router.get('/applications/:applicationId/files', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { applicationId } = req.params;

    const files = await FileMetadata.find({
      'metadata.applicationId': applicationId
    }).sort({ uploadDate: -1 });

    res.json({
      data: files.map((f) => ({
        id: f._id,
        originalName: f.originalName,
        size: f.size,
        category: f.category,
        uploadDate: f.uploadDate,
        uploadedBy: f.uploadedBy,
        url: `/api/files/${f._id}/download`
      })),
      total: files.length
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Lỗi khi tải danh sách file' });
  }
});

// ============= DELETE ENDPOINTS =============

// Delete file
router.delete('/:fileId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;

    // Get file metadata
    const fileMetadata = await FileMetadata.findById(fileId);
    if (!fileMetadata) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }

    // Check permissions
    const isOwner = fileMetadata.uploadedBy.toString() === req.userId;
    const isAdmin = req.user?.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Không có quyền xóa file này' });
    }

    // Delete from GridFS
    await deleteFileFromGridFS(fileMetadata.gridFsId);

    // Delete metadata
    await FileMetadata.findByIdAndDelete(fileId);

    res.json({ message: 'Xóa file thành công' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Lỗi khi xóa file' });
  }
});

// Delete application document
router.delete(
  '/applications/:applicationId/files/:fileId',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { applicationId, fileId } = req.params;

      // Get file metadata
      const fileMetadata = await FileMetadata.findById(fileId);
      if (!fileMetadata) {
        return res.status(404).json({ error: 'File không tồn tại' });
      }

      // Check if file belongs to application
      if (fileMetadata.uploadedFor?.id?.toString() !== applicationId && fileMetadata.uploadedFor?.type !== 'application') {
        return res.status(400).json({ error: 'File không thuộc hồ sơ này' });
      }

      // Check permissions
      const isOwner = fileMetadata.uploadedBy.toString() === req.userId;
      const isAdmin = req.user?.role === 'admin';
      const isStaff = req.user?.role === 'staff';
      if (!isOwner && !isAdmin && !isStaff) {
        return res.status(403).json({ error: 'Không có quyền xóa file này' });
      }

      // Delete from GridFS
      await deleteFileFromGridFS(fileMetadata.gridFsId);

      // Delete metadata
      await FileMetadata.findByIdAndDelete(fileId);

      res.json({ message: 'Xóa file thành công' });
    } catch (error) {
      console.error('Delete error:', error);
      res.status(500).json({ error: 'Lỗi khi xóa file' });
    }
  }
);

export default router;
