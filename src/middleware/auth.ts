import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../utils/tokenBlacklist';
import { User } from '../models/mongoose.models';

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
  tokenVersion?: number;
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ error: 'Lỗi cấu hình máy chủ' });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token không được cung cấp' });
    }

    if (isTokenBlacklisted(token)) {
      return res.status(401).json({ error: 'Token đã bị vô hiệu hóa' });
    }

    const decoded = jwt.verify(token, secret) as { userId: string; role?: string; tokenVersion?: number };
    req.userId = decoded.userId;
    req.tokenVersion = decoded.tokenVersion ?? 0;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token đã hết hạn' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Token không hợp lệ' });
    }
    res.status(401).json({ error: 'Xác thực thất bại' });
  }
};