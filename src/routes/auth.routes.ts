import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/mongoose.models.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginRateLimit, registerRateLimit } from '../middleware/rateLimit.js';
import { validateEmail, validatePassword, validateUsername, validateFullName } from '../utils/validation.js';
import { addTokenToBlacklist } from '../utils/tokenBlacklist.js';
import { logAudit } from '../models/auditLog.js';

const router = express.Router();

router.post('/register', registerRateLimit, async (req, res) => {
  try {
    const { username, email, password, fullName, role } = req.body;

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ errors: usernameValidation.errors });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ errors: passwordValidation.errors });
    }

    const fullNameValidation = validateFullName(fullName);
    if (!fullNameValidation.valid) {
      return res.status(400).json({ errors: fullNameValidation.errors });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Tài khoản hoặc email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      hashedPassword,
      fullName,
      role: role || 'viewer',
      isActive: true
    });

    await logAudit(user._id.toString(), 'register', 'users', 'User registered', 'success', req.ip);

    res.status(201).json({
      message: 'Đăng ký thành công',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Lỗi khi đăng ký' });
  }
});

router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      await logAudit(undefined, 'login', 'users', 'Login failed - user not found', 'failure', req.ip);
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    const isValidPassword = await bcrypt.compare(password, user.hashedPassword);
    if (!isValidPassword) {
      await logAudit(user._id.toString(), 'login', 'users', 'Login failed - invalid password', 'failure', req.ip);
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    user.lastLogin = new Date();
    await user.save();

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    // Sửa lỗi: đảm bảo expiresIn là string đúng định dạng
    const expiresIn = process.env.JWT_EXPIRATION || '7d';
    
    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion },
      secret,
      { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    );

    await logAudit(user._id.toString(), 'login', 'users', 'User logged in', 'success', req.ip);

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Lỗi khi đăng nhập' });
  }
});

router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.userId).select('-hashedPassword');
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy thông tin user' });
  }
});

router.post('/logout', authenticateToken, async (req: any, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        addTokenToBlacklist(token, decoded.exp);
      }
    }
    await logAudit(req.userId, 'logout', 'users', 'User logged out', 'success', req.ip);
    res.json({ message: 'Đã đăng xuất thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi đăng xuất' });
  }
});

router.post('/change-password', authenticateToken, async (req: any, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ errors: passwordValidation.errors });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }

    user.hashedPassword = await bcrypt.hash(newPassword, 10);
    user.tokenVersion += 1;
    await user.save();

    await logAudit(req.userId, 'change_password', 'users', 'Password changed', 'success', req.ip);

    res.json({ message: 'Mật khẩu đã được thay đổi' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi đổi mật khẩu' });
  }
});

export default router;