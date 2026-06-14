import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/database.js';
import { initializeGridFS } from './config/gridfs.js';
import apiRoutes from './routes/api.routes.js';
import fileRoutes from './routes/files.routes.js';
import authRoutes from './routes/auth.routes.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api/files', fileRoutes);

app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Lỗi máy chủ nội bộ'
  });
});

app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint' });
});

// Start server
const PORT = process.env.PORT || 5000;

// Khởi động server sau khi kết nối database
const startServer = async () => {
  try {
    await connectDB();
    initializeGridFS(mongoose);
    
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;