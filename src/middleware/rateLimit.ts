import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

export interface RateLimitOptions {
  windowMs: number; // time window in ms
  maxRequests: number; // max requests per window
  message?: string;
}

export const createRateLimit = (options: RateLimitOptions) => {
  const { windowMs, maxRequests, message = 'Quá nhiều request, vui lòng thử lại sau' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!store[key]) {
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    if (now > store[key].resetTime) {
      store[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    store[key].count++;

    if (store[key].count > maxRequests) {
      return res.status(429).json({ error: message });
    }

    next();
  };
};

// Specific rate limiters
export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // Tăng lên 100 lần để thoải mái test
  message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút'
});

export const registerRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // Tăng lên 20 lần để thuận tiện test
  message: 'Quá nhiều lần đăng ký, vui lòng thử lại sau 1 giờ'
});

export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Quá nhiều request, vui lòng thử lại sau'
});
