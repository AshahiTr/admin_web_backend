import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

let gridFSBucket: GridFSBucket;

export const initializeGridFS = (mongoConnection: typeof mongoose) => {
  const db = mongoConnection.connection.getClient().db(mongoConnection.connection.name);
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
    const chunks: Uint8Array[] = [];

    try {
      const downloadStream = gridFSBucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));

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
      gridFSBucket.delete(new mongoose.Types.ObjectId(fileId), (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

export const getFileMetadata = (fileId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    try {
      const db = mongoose.connection.getClient().db(mongoose.connection.name);
      const filesCollection = db.collection('fs.files');

      filesCollection.findOne({ _id: new mongoose.Types.ObjectId(fileId) }, (error, file) => {
        if (error) {
          reject(error);
        } else {
          resolve(file);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};
