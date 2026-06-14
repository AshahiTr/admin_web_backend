import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { isTokenBlacklisted } from '../utils/tokenBlacklist.js';
import { User } from '../models/mongoose.models.js';

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

export const authorizeRole = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Không được xác thực' });
      }

      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(401).json({ error: 'Người dùng không tồn tại' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Tài khoản đã bị vô hiệu hóa' });
      }

      if (user.tokenVersion !== undefined && req.tokenVersion !== undefined) {
        if (user.tokenVersion !== req.tokenVersion) {
          return res.status(401).json({ error: 'Token đã bị vô hiệu hóa' });
        }
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: 'Không có quyền truy cập' });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Lỗi xác thực quyền' });
    }
  };
};