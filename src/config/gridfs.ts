import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

let gridFSBucket: GridFSBucket;

export const initializeGridFS = (mongoConnection: typeof mongoose) => {
  const db = mongoConnection.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }
  gridFSBucket = new GridFSBucket(db);
  console.log('✅ GridFS initialized');
};

export const getGridFSBucket = (): GridFSBucket => {
  if (!gridFSBucket) {
    throw new Error('GridFS bucket not initialized');
  }
  return gridFSBucket;
};

export const uploadFileToGridFS = (buffer: Buffer, filename: string, metadata: any): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = gridFSBucket.openUploadStream(filename, {
      metadata
    });

    uploadStream.on('error', (error) => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id.toString());
    });

    uploadStream.write(buffer);
    uploadStream.end();
  });
};

export const downloadFileFromGridFS = (fileId: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    try {
      const downloadStream = gridFSBucket.openDownloadStream(new ObjectId(fileId));

      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      downloadStream.on('error', (error) => {
        reject(error);
      });

      downloadStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const deleteFileFromGridFS = (fileId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Sửa lỗi: delete method chỉ nhận 1 argument
      gridFSBucket.delete(new ObjectId(fileId));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

export const getFileMetadata = async (fileId: string): Promise<any> => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');
    
    const filesCollection = db.collection('fs.files');
    const file = await filesCollection.findOne({ _id: new ObjectId(fileId) });
    return file;
  } catch (error) {
    throw error;
  }
};