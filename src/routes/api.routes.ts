import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import {
  School,
  Major,
  AdmissionBlock,
  Quota,
  Application,
  User,
  Document,
  Statistics
} from '../models/mongoose.models';
import { authenticateToken, authorizeRole, AuthRequest } from '../middleware/auth';
import { loginRateLimit, registerRateLimit, apiRateLimit } from '../middleware/rateLimit';
import { addTokenToBlacklist, isTokenBlacklisted } from '../utils/tokenBlacklist';
import { logAudit } from '../models/auditLog';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateFullName
} from '../utils/validation';
import { getPaginationParams, getPaginatedResponse, buildFilter, buildDateFilter } from '../utils/helpers';

const router = express.Router();

// Apply rate limiting to all API routes
router.use(apiRateLimit);

// ============= ROOT API ENDPOINT =============

// API Welcome
router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Chào mừng đến API Quản Lý Tuyển Sinh',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout (auth required)',
        me: 'GET /api/auth/me (auth required)',
        changePassword: 'POST /api/auth/change-password (auth required)',
        refreshToken: 'POST /api/auth/refresh-token',
        resetPasswordRequest: 'POST /api/auth/reset-password-request',
        resetPasswordConfirm: 'POST /api/auth/reset-password-confirm'
      },
      schools: {
        getAll: 'GET /api/schools',
        getById: 'GET /api/schools/:id',
        create: 'POST /api/schools (auth required)',
        update: 'PUT /api/schools/:id (auth required)',
        delete: 'DELETE /api/schools/:id (auth required)'
      },
      majors: {
        getBySchool: 'GET /api/schools/:schoolId/majors',
        create: 'POST /api/majors (auth required)'
      },
      admissionBlocks: {
        getByMajor: 'GET /api/majors/:majorId/blocks',
        create: 'POST /api/admission-blocks (auth required)'
      },
      applications: {
        getAll: 'GET /api/applications',
        getById: 'GET /api/applications/:id',
        create: 'POST /api/applications',
        updateScores: 'PUT /api/applications/:id/scores (auth required)',
        updateStatus: 'PUT /api/applications/:id/status (auth required)',
        search: 'GET /api/applications/search/:query',
        export: 'GET /api/applications/export/csv'
      },
      statistics: {
        dashboard: 'GET /api/statistics/dashboard'
      },
      users: {
        getAll: 'GET /api/users (admin only)',
        create: 'POST /api/users (admin only)',
        update: 'PUT /api/users/:id (admin only)',
        delete: 'DELETE /api/users/:id (admin only)'
      }
    },
    documentation: 'Xem API_AUTHENTICATION.md để biết chi tiết'
  });
});

// ============= AUTHENTICATION ENDPOINTS =============

// REGISTER (with validation)
router.post('/auth/register', registerRateLimit, async (req: Request, res: Response) => {
  try {
    const { username, email, password, fullName } = req.body;
    // Security: Enforce 'viewer' role for public registration
    // Roles can only be changed by an administrator later
    const role = 'viewer';
    const ipAddress = req.ip || req.socket.remoteAddress;

    // Validation
    const emailValid = validateEmail(email);
    if (!emailValid) {
      await logAudit(undefined, 'register', 'users', 'Đăng ký với email không hợp lệ', 'failure', ipAddress, 'Invalid email');
      return res.status(400).json({ error: 'Email không hợp lệ' });
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      await logAudit(undefined, 'register', 'users', `Đăng ký với username: ${username}`, 'failure', ipAddress, JSON.stringify(usernameValidation.errors));
      return res.status(400).json({ errors: usernameValidation.errors });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      await logAudit(undefined, 'register', 'users', 'Mật khẩu không đủ mạnh', 'failure', ipAddress, JSON.stringify(passwordValidation.errors));
      return res.status(400).json({ errors: passwordValidation.errors });
    }

    const fullNameValidation = validateFullName(fullName);
    if (!fullNameValidation.valid) {
      await logAudit(undefined, 'register', 'users', 'Tên không hợp lệ', 'failure', ipAddress);
      return res.status(400).json({ errors: fullNameValidation.errors });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      await logAudit(undefined, 'register', 'users', `Tài khoản đã tồn tại: ${email || username}`, 'failure', ipAddress);
      return res.status(400).json({ error: 'Tài khoản đã tồn tại' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      hashedPassword,
      fullName,
      role,
      isActive: true
    });

    await user.save();
    await logAudit(user._id.toString(), 'register', 'users', `Đăng ký tài khoản: ${username}`, 'success', ipAddress);

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
    console.error('Registration error:', error);
    await logAudit(undefined, 'register', 'users', 'Lỗi server', 'failure', req.ip, (error as any).message);
    res.status(500).json({ error: 'Lỗi khi đăng ký', details: (error as any).message });
  }
});

// LOGIN (with rate limiting)
router.post('/auth/login', loginRateLimit, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (!email || !password) {
      await logAudit(undefined, 'login', 'users', 'Thiếu email hoặc mật khẩu', 'failure', ipAddress);
      return res.status(400).json({ error: 'Vui lòng cung cấp email và mật khẩu' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      await logAudit(undefined, 'login', 'users', `Đăng nhập thất bại: ${email}`, 'failure', ipAddress);
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    // Compare passwords
    const isValidPassword = await bcrypt.compare(password, user.hashedPassword);
    if (!isValidPassword) {
      await logAudit(user._id.toString(), 'login', 'users', `Sai mật khẩu`, 'failure', ipAddress);
      return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác' });
    }

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ error: 'Lỗi cấu hình máy chủ' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 },
      secret,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();
    await logAudit(user._id.toString(), 'login', 'users', `Đăng nhập thành công`, 'success', ipAddress);

    res.json({
      message: 'Đăng nhập thành công',
      token,
      refreshToken: jwt.sign(
        { userId: user._id, type: 'refresh', tokenVersion: user.tokenVersion || 0 },
        secret,
        { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '30d' }
      ),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role
      }
    });
  } catch (error) {
    await logAudit(undefined, 'login', 'users', 'Lỗi server', 'failure', req.ip, (error as any).message);
    res.status(500).json({ error: 'Lỗi khi đăng nhập' });
  }
});

// GET current user info
router.get('/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-hashedPassword');
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải thông tin' });
  }
});

// LOGOUT (add token to blacklist)
router.post('/auth/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const expiryTime = decoded?.exp || Math.floor(Date.now() / 1000) + 86400;
      addTokenToBlacklist(token, expiryTime);
    }

    await logAudit(req.userId, 'logout', 'users', 'Đăng xuất', 'success', req.ip);

    res.json({ message: 'Đã đăng xuất thành công' });
  } catch (error) {
    await logAudit(req.userId, 'logout', 'users', 'Lỗi server', 'failure', req.ip, (error as any).message);
    res.status(500).json({ error: 'Lỗi khi đăng xuất' });
  }
});

// CHANGE PASSWORD
router.post('/auth/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Vui lòng cung cấp tất cả thông tin' });
    }

    if (newPassword !== confirmPassword) {
      await logAudit(req.userId, 'change_password', 'users', 'Xác nhận mật khẩu không khớp', 'failure', ipAddress);
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      await logAudit(req.userId, 'change_password', 'users', 'Mật khẩu mới không đủ mạnh', 'failure', ipAddress, JSON.stringify(passwordValidation.errors));
      return res.status(400).json({ errors: passwordValidation.errors });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!isValidPassword) {
      await logAudit(req.userId, 'change_password', 'users', 'Mật khẩu hiện tại không chính xác', 'failure', ipAddress);
      return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }

    // Hash new password
    user.hashedPassword = await bcrypt.hash(newPassword, 10);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAudit(req.userId, 'change_password', 'users', 'Thay đổi mật khẩu thành công', 'success', ipAddress);

    res.json({ message: 'Mật khẩu đã được thay đổi' });
  } catch (error) {
    await logAudit(req.userId, 'change_password', 'users', 'Lỗi server', 'failure', req.ip, (error as any).message);
    res.status(500).json({ error: 'Lỗi khi thay đổi mật khẩu' });
  }
});

// REFRESH TOKEN
router.post('/auth/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token không được cung cấp' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({ error: 'Lỗi cấu hình máy chủ' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, secret);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Refresh token đã hết hạn' });
      }
      return res.status(401).json({ error: 'Refresh token không hợp lệ' });
    }

    if (isTokenBlacklisted(refreshToken)) {
      return res.status(401).json({ error: 'Refresh token đã bị vô hiệu hóa' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token không phải refresh token' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa' });
    }

    if (user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: 'Token đã bị vô hiệu hóa' });
    }

    const newToken = jwt.sign(
      { userId: user._id, email: user.email, role: user.role, tokenVersion: user.tokenVersion || 0 },
      secret,
      { expiresIn: process.env.JWT_EXPIRATION || '7d' }
    );

    res.json({
      message: 'Token đã được làm mới',
      token: newToken
    });
  } catch (error) {
    res.status(403).json({ error: 'Refresh token không hợp lệ' });
  }
});

// RESET PASSWORD REQUEST (step 1 - send reset code)
router.post('/auth/reset-password-request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (!email) {
      return res.status(400).json({ error: 'Vui lòng cung cấp email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await logAudit(undefined, 'reset_password_request', 'users', `Email không tồn tại: ${email}`, 'failure', ipAddress);
      // Don't reveal if email exists (security best practice)
      return res.status(200).json({ message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu' });
    }

    // Generate reset code (6 digits)
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetCodeExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Save reset code to user (in production, use email verification)
    user.passwordResetCode = resetCode;
    user.passwordResetExpiry = resetCodeExpiry;
    await user.save();

    await logAudit(user._id.toString(), 'reset_password_request', 'users', `Yêu cầu đặt lại mật khẩu`, 'success', ipAddress);

    // In production, send email with reset code
    // For now, return reset code (ONLY FOR DEVELOPMENT!)
    res.status(200).json({
      message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu',
      // REMOVE THIS IN PRODUCTION - only for testing:
      _dev_resetCode: resetCode // Development only!
    });
  } catch (error) {
    await logAudit(undefined, 'reset_password_request', 'users', 'Lỗi server', 'failure', req.ip, (error as any).message);
    res.status(500).json({ error: 'Lỗi khi yêu cầu đặt lại mật khẩu' });
  }
});

// RESET PASSWORD CONFIRM (step 2 - verify code and reset)
router.post('/auth/reset-password-confirm', async (req: Request, res: Response) => {
  try {
    const { email, resetCode, newPassword, confirmPassword } = req.body;
    const ipAddress = req.ip || req.socket.remoteAddress;

    if (!email || !resetCode || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Vui lòng cung cấp tất cả thông tin' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      await logAudit(undefined, 'reset_password_confirm', 'users', 'Email không tồn tại', 'failure', ipAddress);
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    // Verify reset code
    if (!user.passwordResetCode || user.passwordResetCode !== resetCode) {
      await logAudit(user._id.toString(), 'reset_password_confirm', 'users', 'Mã reset không đúng', 'failure', ipAddress);
      return res.status(400).json({ error: 'Mã xác nhận không chính xác' });
    }

    // Check if reset code expired
    if (!user.passwordResetExpiry || new Date() > user.passwordResetExpiry) {
      await logAudit(user._id.toString(), 'reset_password_confirm', 'users', 'Mã reset hết hạn', 'failure', ipAddress);
      return res.status(400).json({ error: 'Mã xác nhận đã hết hạn' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      await logAudit(user._id.toString(), 'reset_password_confirm', 'users', 'Mật khẩu không đủ mạnh', 'failure', ipAddress);
      return res.status(400).json({ errors: passwordValidation.errors });
    }

    // Update password
    user.hashedPassword = await bcrypt.hash(newPassword, 10);
    user.passwordResetCode = undefined;
    user.passwordResetExpiry = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await logAudit(user._id.toString(), 'reset_password_confirm', 'users', 'Đặt lại mật khẩu thành công', 'success', ipAddress);

    res.json({ message: 'Mật khẩu đã được đặt lại' });
  } catch (error) {
    await logAudit(undefined, 'reset_password_confirm', 'users', 'Lỗi server', 'failure', req.ip, (error as any).message);
    res.status(500).json({ error: 'Lỗi khi đặt lại mật khẩu' });
  }
});

// ============= PROTECTED ADMIN ENDPOINTS =============

// GET all users (admin only)
router.get('/users', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find()
      .select('-hashedPassword -passwordResetCode -passwordResetExpiry')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải danh sách người dùng' });
  }
});

// CREATE user (admin only)
router.post('/users', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, fullName, role = 'viewer' } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Tài khoản đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      hashedPassword,
      fullName,
      role,
      isActive: true
    });

    await user.save();

    res.status(201).json({
      id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tạo người dùng' });
  }
});

// UPDATE user (admin only)
router.put('/users/:id', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, role, isActive, schoolId } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    const roleChanged = role !== undefined && role !== user.role;
    const deactivated = isActive === false && user.isActive;

    if (fullName !== undefined) user.fullName = fullName;
    if (role !== undefined) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    if (schoolId !== undefined) user.schoolId = schoolId;

    if (roleChanged || deactivated) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    await user.save();

    const sanitized = user.toObject();
    delete sanitized.hashedPassword;
    delete sanitized.passwordResetCode;
    delete sanitized.passwordResetExpiry;
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật người dùng' });
  }
});

// DELETE user (admin only)
router.delete('/users/:id', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if (req.userId === req.params.id) {
      return res.status(400).json({ error: 'Không thể vô hiệu hóa chính mình' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Người dùng không tồn tại' });
    }

    user.isActive = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ message: 'Vô hiệu hóa người dùng thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa người dùng' });
  }
});

// ============= SCHOOLS ENDPOINTS =============

// GET all schools
router.get('/schools', async (req: Request, res: Response) => {
  try {
    const schools = await School.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(schools);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu trường' });
  }
});

// GET school by ID
router.get('/schools/:id', async (req: Request, res: Response) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) return res.status(404).json({ error: 'Trường không tồn tại' });
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu' });
  }
});

// CREATE school (protected)
router.post('/schools', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, description, address, phone, email, website, logo } =
      req.body;

    // Check if code already exists
    const exists = await School.findOne({ code });
    if (exists) {
      return res.status(400).json({ error: 'Mã trường đã tồn tại' });
    }

    const school = new School({
      code,
      name,
      description,
      address,
      phone,
      email,
      website,
      logo,
      isActive: true
    });

    await school.save();
    res.status(201).json(school);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi thêm mới trường' });
  }
});

// UPDATE school (protected)
router.put('/schools/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, {
      new: true
    });
    if (!school) return res.status(404).json({ error: 'Trường không tồn tại' });
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật' });
  }
});

// DELETE school (protected)
router.delete('/schools/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    // Soft delete
    const school = await School.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!school) return res.status(404).json({ error: 'Trường không tồn tại' });
    res.json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa' });
  }
});

// ============= MAJORS ENDPOINTS =============

// GET majors by school
router.get('/schools/:schoolId/majors', async (req: Request, res: Response) => {
  try {
    const majors = await Major.find({
      schoolId: req.params.schoolId,
      isActive: true
    }).sort({ createdAt: -1 });
    res.json(majors);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải ngành học' });
  }
});

// CREATE major (protected)
router.post('/majors', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { schoolId, code, name, description, tuitionPerSemester, duration } =
      req.body;

    // Verify school exists
    const school = await School.findById(schoolId);
    if (!school) return res.status(400).json({ error: 'Trường không tồn tại' });

    const major = new Major({
      schoolId,
      code,
      name,
      description,
      tuitionPerSemester,
      duration,
      isActive: true
    });

    await major.save();
    res.status(201).json(major);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi thêm mới ngành' });
  }
});

// GET single major by ID
router.get('/majors/:id', async (req: Request, res: Response) => {
  try {
    const major = await Major.findById(req.params.id).populate('schoolId');
    if (!major) return res.status(404).json({ error: 'Ngành học không tồn tại' });
    res.json(major);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải ngành học' });
  }
});

// UPDATE major (protected)
router.put('/majors/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, description, tuitionPerSemester, duration, studyForm, isActive } = req.body;

    const major = await Major.findByIdAndUpdate(
      req.params.id,
      { code, name, description, tuitionPerSemester, duration, studyForm, isActive },
      { new: true }
    );

    if (!major) return res.status(404).json({ error: 'Ngành học không tồn tại' });
    res.json({ message: 'Cập nhật ngành học thành công', data: major });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật ngành học' });
  }
});

// DELETE major (protected) - soft delete
router.delete('/majors/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const major = await Major.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!major) return res.status(404).json({ error: 'Ngành học không tồn tại' });
    res.json({ message: 'Xóa ngành học thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa ngành học' });
  }
});

// ============= ADMISSION BLOCKS ENDPOINTS =============

// GET admission blocks by major
router.get('/majors/:majorId/blocks', async (req: Request, res: Response) => {
  try {
    const blocks = await AdmissionBlock.find({
      majorId: req.params.majorId,
      isActive: true
    }).sort({ year: -1 });
    res.json(blocks);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải khối tuyển sinh' });
  }
});

// CREATE admission block (protected)
router.post('/admission-blocks', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { majorId, code, name, subjects, year } = req.body;

    const block = new AdmissionBlock({
      majorId,
      code,
      name,
      subjects,
      year,
      isActive: true
    });

    await block.save();
    res.status(201).json(block);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi thêm mới khối tuyển sinh' });
  }
});

// GET single admission block
router.get('/admission-blocks/:id', async (req: Request, res: Response) => {
  try {
    const block = await AdmissionBlock.findById(req.params.id).populate('majorId');
    if (!block) return res.status(404).json({ error: 'Khối tuyển sinh không tồn tại' });
    res.json(block);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải khối tuyển sinh' });
  }
});

// UPDATE admission block (protected)
router.put('/admission-blocks/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, subjects, description, year, isActive } = req.body;

    const block = await AdmissionBlock.findByIdAndUpdate(
      req.params.id,
      { code, name, subjects, description, year, isActive },
      { new: true }
    );

    if (!block) return res.status(404).json({ error: 'Khối tuyển sinh không tồn tại' });
    res.json({ message: 'Cập nhật khối tuyển sinh thành công', data: block });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật khối tuyển sinh' });
  }
});

// DELETE admission block (protected) - soft delete
router.delete('/admission-blocks/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const block = await AdmissionBlock.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!block) return res.status(404).json({ error: 'Khối tuyển sinh không tồn tại' });
    res.json({ message: 'Xóa khối tuyển sinh thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa khối tuyển sinh' });
  }
});

// ============= QUOTAS ENDPOINTS =============

// GET quota for admission block
router.get('/quotas/:blockId', async (req: Request, res: Response) => {
  try {
    const quota = await Quota.findOne({
      admissionBlockId: req.params.blockId
    }).populate('admissionBlockId').populate('majorId');
    if (!quota) return res.status(404).json({ error: 'Chỉ tiêu không tồn tại' });
    res.json(quota);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải chỉ tiêu' });
  }
});

// CREATE quota (protected)
router.post('/quotas', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { admissionBlockId, majorId, quota, year } = req.body;

    const newQuota = new Quota({
      admissionBlockId,
      majorId,
      quota,
      enrolled: 0,
      available: quota,
      year
    });

    await newQuota.save();
    res.status(201).json(newQuota);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tạo chỉ tiêu' });
  }
});

// GET all quotas (with pagination & filters)
router.get('/quotas', async (req: Request, res: Response) => {
  try {
    const { schoolId, majorId, admissionBlockId, year, page, limit } = req.query;
    const { skip, page: p, limit: l } = getPaginationParams(page, limit);

    const filter: any = {};
    if (schoolId) filter.schoolId = schoolId;
    if (majorId) filter.majorId = majorId;
    if (admissionBlockId) filter.admissionBlockId = admissionBlockId;
    if (year) filter.year = parseInt(year as string);

    const quotas = await Quota.find(filter)
      .skip(skip)
      .limit(l)
      .populate('admissionBlockId')
      .populate('majorId')
      .sort({ createdAt: -1 });

    const total = await Quota.countDocuments(filter);

    res.json(getPaginatedResponse(quotas, total, p, l));
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải chỉ tiêu' });
  }
});

// GET single quota by ID
router.get('/quotas/:id', async (req: Request, res: Response) => {
  try {
    const quota = await Quota.findById(req.params.id)
      .populate('admissionBlockId')
      .populate('majorId');
    if (!quota) return res.status(404).json({ error: 'Chỉ tiêu không tồn tại' });
    res.json(quota);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải chỉ tiêu' });
  }
});

// UPDATE quota (protected)
router.put('/quotas/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { quota, enrolled, available, priority } = req.body;

    const updatedQuota = await Quota.findByIdAndUpdate(
      req.params.id,
      { quota, enrolled, available, priority },
      { new: true }
    ).populate('admissionBlockId').populate('majorId');

    if (!updatedQuota) return res.status(404).json({ error: 'Chỉ tiêu không tồn tại' });
    res.json({ message: 'Cập nhật chỉ tiêu thành công', data: updatedQuota });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật chỉ tiêu' });
  }
});

// DELETE quota (protected)
router.delete('/quotas/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const quota = await Quota.findByIdAndDelete(req.params.id);
    if (!quota) return res.status(404).json({ error: 'Chỉ tiêu không tồn tại' });
    res.json({ message: 'Xóa chỉ tiêu thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa chỉ tiêu' });
  }
});

// ============= APPLICATIONS ENDPOINTS =============

// GET all applications (with filters)
router.get('/applications', async (req: Request, res: Response) => {
  try {
    const {
      status,
      schoolId,
      majorId,
      year,
      limit = 20,
      page = 1
    } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: any = { isActive: true };
    if (status) filter['admissionResult.status'] = status;
    if (schoolId) filter.schoolId = schoolId;
    if (majorId) filter.majorId = majorId;

    const applications = await Application.find(filter)
      .limit(Number(limit))
      .skip(skip)
      .sort({ createdAt: -1 })
      .populate('admissionBlockId')
      .populate('majorId')
      .populate('schoolId');

    const total = await Application.countDocuments(filter);

    res.json({
      data: applications,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải hồ sơ' });
  }
});

// GET application by ID
router.get('/applications/:id', async (req: Request, res: Response) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('admissionBlockId')
      .populate('majorId')
      .populate('schoolId');

    if (!application) {
      return res.status(404).json({ error: 'Hồ sơ không tồn tại' });
    }
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải hồ sơ' });
  }
});

// CREATE application
router.post('/applications', async (req: Request, res: Response) => {
  try {
    const {
      admissionBlockId,
      majorId,
      schoolId,
      personalInfo,
      academicInfo
    } = req.body;

    // Generate application number
    const count = await Application.countDocuments();
    const year = new Date().getFullYear();
    const applicationNumber = `TS${year}${String(count + 1).padStart(6, '0')}`;

    const application = new Application({
      applicationNumber,
      admissionBlockId,
      majorId,
      schoolId,
      personalInfo,
      academicInfo,
      admissionResult: { status: 'pending' },
      processStatus: 'submitted',
      completionPercentage: 0,
      isActive: true
    });

    await application.save();
    res.status(201).json(application);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tạo hồ sơ' });
  }
});

// UPDATE application scores (protected)
router.put('/applications/:id/scores', authenticateToken, authorizeRole('admin', 'staff', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { academicInfo } = req.body;
    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ error: 'Hồ sơ không tồn tại' });
    }

    application.academicInfo = academicInfo;

    // Calculate total score
    const { mathScore, physicsScore, chemistryScore, priorityPoints = 0 } =
      academicInfo;
    if (mathScore && physicsScore && chemistryScore) {
      const totalScore = (mathScore + physicsScore + chemistryScore) / 3;
      application.admissionResult.totalScore = totalScore;
      application.admissionResult.finalScore = totalScore + priorityPoints;
    }

    await application.save();
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật điểm' });
  }
});

// UPDATE application status (protected)
router.put('/applications/:id/status', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, note } = req.body;
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      {
        'admissionResult.status': status,
        'admissionResult.note': note,
        'admissionResult.resultDate': new Date(),
        processStatus: 'completed'
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ error: 'Hồ sơ không tồn tại' });
    }

    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái' });
  }
});

// DELETE application (protected) - soft delete
router.delete('/applications/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ error: 'Hồ sơ không tồn tại' });
    }

    res.json({ message: 'Xóa hồ sơ thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa hồ sơ' });
  }
});

// ============= STATISTICS ENDPOINTS =============

// GET dashboard statistics
router.get('/statistics/dashboard', async (req: Request, res: Response) => {
  try {
    const { schoolId, year = new Date().getFullYear() } = req.query;

    const filter: any = { isActive: true };
    if (schoolId) filter.schoolId = schoolId;

    // Get application counts by status
    const statusCounts = await Application.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$admissionResult.status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Calculate average score
    const avgScore = await Application.aggregate([
      {
        $match: {
          ...filter,
          'admissionResult.totalScore': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          average: { $avg: '$admissionResult.totalScore' }
        }
      }
    ]);

    // Get stats by major
    const majorStats = await Application.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$majorId',
          applications: { $sum: 1 },
          accepted: {
            $sum: {
              $cond: [
                { $eq: ['$admissionResult.status', 'accepted'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'majors',
          localField: '_id',
          foreignField: '_id',
          as: 'majorInfo'
        }
      }
    ]);

    res.json({
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])),
      averageScore: avgScore[0]?.average || 0,
      majorStats: majorStats.map((m) => ({
        majorId: m._id,
        majorName: m.majorInfo[0]?.name,
        applications: m.applications,
        accepted: m.accepted,
        ratio: (m.accepted / m.applications * 100).toFixed(2)
      }))
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
});

// GET all statistics (with pagination & filters)
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const { schoolId, type, dateFrom, dateTo, page, limit } = req.query;
    const { skip, page: p, limit: l } = getPaginationParams(page, limit);

    const filter: any = {};
    if (schoolId) filter.schoolId = schoolId;
    if (type) filter.type = type;

    const dateFilter = buildDateFilter(dateFrom as string, dateTo as string);
    if (dateFilter) filter.date = dateFilter;

    const statistics = await Statistics.find(filter)
      .skip(skip)
      .limit(l)
      .sort({ date: -1 });

    const total = await Statistics.countDocuments(filter);

    res.json(getPaginatedResponse(statistics, total, p, l));
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
});

// GET single statistic by ID
router.get('/statistics/:id', async (req: Request, res: Response) => {
  try {
    const stat = await Statistics.findById(req.params.id);
    if (!stat) return res.status(404).json({ error: 'Thống kê không tồn tại' });
    res.json(stat);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
});

// GET statistics by school
router.get('/statistics/school/:schoolId', async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const { type, dateFrom, dateTo, page, limit } = req.query;
    const { skip, page: p, limit: l } = getPaginationParams(page, limit);

    const filter: any = { schoolId };
    if (type) filter.type = type;

    const dateFilter = buildDateFilter(dateFrom as string, dateTo as string);
    if (dateFilter) filter.date = dateFilter;

    const statistics = await Statistics.find(filter)
      .skip(skip)
      .limit(l)
      .sort({ date: -1 });

    const total = await Statistics.countDocuments(filter);

    res.json(getPaginatedResponse(statistics, total, p, l));
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
});

// GET statistics by major
router.get('/statistics/major/:majorId', async (req: Request, res: Response) => {
  try {
    const { majorId } = req.params;
    const { type, dateFrom, dateTo, page, limit } = req.query;
    const { skip, page: p, limit: l } = getPaginationParams(page, limit);

    const filter: any = {
      'majorStats.majorId': majorId
    };
    if (type) filter.type = type;

    const dateFilter = buildDateFilter(dateFrom as string, dateTo as string);
    if (dateFilter) filter.date = dateFilter;

    const statistics = await Statistics.find(filter)
      .skip(skip)
      .limit(l)
      .sort({ date: -1 });

    const total = await Statistics.countDocuments(filter);

    res.json(getPaginatedResponse(statistics, total, p, l));
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tải thống kê' });
  }
});

// GENERATE statistics (admin only)
router.post('/statistics/generate', authenticateToken, authorizeRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { type = 'daily', schoolId } = req.body;

    if (!['daily', 'monthly', 'yearly'].includes(type)) {
      return res.status(400).json({ error: 'Loại thống kê không hợp lệ' });
    }

    const filter: any = { isActive: true };
    if (schoolId) filter.schoolId = schoolId;

    // Get application counts by status
    const statusCounts = await Application.aggregate([
      { $match: filter },
      { $group: { _id: '$admissionResult.status', count: { $sum: 1 } } }
    ]);

    // Calculate average score
    const avgScore = await Application.aggregate([
      { $match: { ...filter, 'admissionResult.totalScore': { $exists: true } } },
      { $group: { _id: null, average: { $avg: '$admissionResult.totalScore' } } }
    ]);

    // Get major stats
    const majorStats = await Application.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$majorId',
          applications: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$admissionResult.status', 'accepted'] }, 1, 0] } }
        }
      }
    ]);

    // Create statistics record
    const stat = new Statistics({
      type,
      date: new Date(),
      schoolId: schoolId || undefined,
      metrics: {
        totalApplications: statusCounts.reduce((sum: number, s: any) => sum + s.count, 0),
        acceptedApplications: statusCounts.find((s: any) => s._id === 'accepted')?.count || 0,
        rejectedApplications: statusCounts.find((s: any) => s._id === 'rejected')?.count || 0,
        waitlistedApplications: statusCounts.find((s: any) => s._id === 'waitlisted')?.count || 0,
        pendingApplications: statusCounts.find((s: any) => s._id === 'pending')?.count || 0,
        averageScore: avgScore[0]?.average || 0,
        scoreDistribution: {
          '0-5': 0,
          '5-10': 0,
          '10-15': 0,
          '15-20': 0,
          '20-25': 0,
          '25+': 0
        }
      },
      majorStats: majorStats.map((m: any) => ({
        majorId: m._id,
        applications: m.applications,
        accepted: m.accepted,
        ratio: m.applications > 0 ? (m.accepted / m.applications) : 0
      }))
    });

    await stat.save();

    res.status(201).json({
      message: 'Tạo thống kê thành công',
      data: stat
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tạo thống kê' });
  }
});

// ============= SEARCH ENDPOINTS =============

// Search applications by name or email
router.get('/applications/search/:query', async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const applications = await Application.find({
      $or: [
        { 'personalInfo.fullName': { $regex: query, $options: 'i' } },
        { 'personalInfo.email': { $regex: query, $options: 'i' } },
        { applicationNumber: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);

    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tìm kiếm' });
  }
});

// ============= EXPORT ENDPOINTS =============

// Export applications to CSV
router.get('/applications/export/csv', async (req: Request, res: Response) => {
  try {
    const { schoolId, status } = req.query;
    const filter: any = { isActive: true };
    if (schoolId) filter.schoolId = schoolId;
    if (status) filter['admissionResult.status'] = status;

    const applications = await Application.find(filter)
      .populate('majorId')
      .populate('schoolId');

    // Convert to CSV (basic implementation)
    let csv = 'Mã Hồ Sơ,Tên,Email,Trường,Ngành,Trạng Thái,Điểm\n';
    applications.forEach((app) => {
      csv += `${app.applicationNumber},${app.personalInfo.fullName},${app.personalInfo.email},${app.schoolId?.name || ''},${app.majorId?.name || ''},${app.admissionResult.status},${app.admissionResult.totalScore || ''}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.header(
      'Content-Disposition',
      'attachment; filename="applications.csv"'
    );
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xuất dữ liệu' });
  }
});

// SEED DATA (development only)
router.post('/seed-data', async (req: Request, res: Response) => {
  try {
    // Clear existing data
    await School.deleteMany({});
    await Major.deleteMany({});
    await AdmissionBlock.deleteMany({});
    await Application.deleteMany({});
    await User.deleteMany({});

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@admission.vn',
      hashedPassword,
      fullName: 'Admin User',
      role: 'admin',
      isActive: true
    });

    // Seed schools
    const schools = await School.insertMany([
      {
        code: 'PTIT',
        name: 'Học viện Công nghệ Bưu chính Viễn thông',
        description: 'Trường đại học công lập',
        address: 'Km 20 Đại lộ Thăng Long, Hà Nội',
        phone: '0243.785.6789',
        email: 'info@ptit.edu.vn',
        website: 'https://ptit.edu.vn',
        isActive: true
      },
      {
        code: 'HUST',
        name: 'Đại học Bách khoa Hà Nội',
        description: 'Trường đại học kỹ thuật hàng đầu',
        address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội',
        phone: '0243.860.3000',
        email: 'info@hust.edu.vn',
        website: 'https://hust.edu.vn',
        isActive: true
      }
    ]);

    // Seed majors
    const majors = await Major.insertMany([
      {
        schoolId: schools[0]._id,
        code: 'IT',
        name: 'Công nghệ Thông tin',
        description: 'Chuyên ngành công nghệ thông tin',
        tuitionPerSemester: 1500000,
        duration: 4,
        studyForm: 'fulltime',
        isActive: true
      },
      {
        schoolId: schools[0]._id,
        code: 'CS',
        name: 'Khoa học Máy tính',
        description: 'Chuyên ngành khoa học máy tính',
        tuitionPerSemester: 1500000,
        duration: 4,
        studyForm: 'fulltime',
        isActive: true
      },
      {
        schoolId: schools[1]._id,
        code: 'EE',
        name: 'Kỹ thuật Điện',
        description: 'Chuyên ngành kỹ thuật điện',
        tuitionPerSemester: 1400000,
        duration: 4,
        studyForm: 'fulltime',
        isActive: true
      }
    ]);

    // Seed admission blocks
    const blocks = await AdmissionBlock.insertMany([
      {
        majorId: majors[0]._id,
        code: 'A',
        name: 'Khối A',
        subjects: ['Toán', 'Lý', 'Hóa'],
        description: 'Khối thi gồm Toán, Lý, Hóa học',
        year: new Date().getFullYear(),
        isActive: true
      },
      {
        majorId: majors[1]._id,
        code: 'B',
        name: 'Khối B',
        subjects: ['Toán', 'Hóa', 'Sinh'],
        description: 'Khối thi gồm Toán, Hóa học, Sinh học',
        year: new Date().getFullYear(),
        isActive: true
      }
    ]);

    // Seed applications
    const applications = await Application.insertMany([
      {
        applicationNumber: 'APP-001',
        schoolId: schools[0]._id,
        majorId: majors[0]._id,
        admissionBlockId: blocks[0]._id,
        personalInfo: {
          fullName: 'Nguyễn Văn A',
          dateOfBirth: new Date('2004-01-15'),
          gender: 'M',
          email: 'nguyenvana@email.com',
          phoneNumber: '0901234567',
          address: 'Hà Nội'
        },
        academicInfo: {
          highSchoolName: 'THPT Chuyên Hà Nội - Amsterdam',
          graduationYear: 2024,
          gpa: 9.5,
          mathScore: 9.0,
          physicsScore: 8.5,
          chemistryScore: 9.0
        },
        admissionResult: {
          status: 'pending',
          totalScore: 8.83
        },
        processStatus: 'submitted',
        completionPercentage: 100,
        isActive: true
      },
      {
        applicationNumber: 'APP-002',
        schoolId: schools[0]._id,
        majorId: majors[1]._id,
        admissionBlockId: blocks[1]._id,
        personalInfo: {
          fullName: 'Trần Thị B',
          dateOfBirth: new Date('2004-03-20'),
          gender: 'F',
          email: 'tranthib@email.com',
          phoneNumber: '0912345678',
          address: 'Hà Nội'
        },
        academicInfo: {
          highSchoolName: 'THPT Nguyễn Huệ',
          graduationYear: 2024,
          gpa: 8.8,
          mathScore: 8.5,
          physicsScore: 8.0,
          chemistryScore: 9.5
        },
        admissionResult: {
          status: 'pending',
          totalScore: 8.67
        },
        processStatus: 'submitted',
        completionPercentage: 100,
        isActive: true
      },
      {
        applicationNumber: 'APP-003',
        schoolId: schools[1]._id,
        majorId: majors[2]._id,
        admissionBlockId: blocks[0]._id,
        personalInfo: {
          fullName: 'Lê Văn C',
          dateOfBirth: new Date('2005-05-10'),
          gender: 'M',
          email: 'levanc@email.com',
          phoneNumber: '0923456789',
          address: 'Hà Nội'
        },
        academicInfo: {
          highSchoolName: 'THPT Phan Bội Châu',
          graduationYear: 2024,
          gpa: 8.2,
          mathScore: 8.0,
          physicsScore: 8.5,
          chemistryScore: 7.8
        },
        admissionResult: {
          status: 'accepted',
          totalScore: 8.1
        },
        processStatus: 'completed',
        completionPercentage: 100,
        isActive: true
      },
      {
        applicationNumber: 'APP-004',
        schoolId: schools[0]._id,
        majorId: majors[0]._id,
        admissionBlockId: blocks[0]._id,
        personalInfo: {
          fullName: 'Phạm Thị D',
          dateOfBirth: new Date('2004-07-25'),
          gender: 'F',
          email: 'phamthid@email.com',
          phoneNumber: '0934567890',
          address: 'Hà Nội'
        },
        academicInfo: {
          highSchoolName: 'THPT Lê Quý Đôn',
          graduationYear: 2024,
          gpa: 9.0,
          mathScore: 9.5,
          physicsScore: 9.0,
          chemistryScore: 8.5
        },
        admissionResult: {
          status: 'accepted',
          totalScore: 9.0
        },
        processStatus: 'completed',
        completionPercentage: 100,
        isActive: true
      },
      {
        applicationNumber: 'APP-005',
        schoolId: schools[1]._id,
        majorId: majors[2]._id,
        admissionBlockId: blocks[1]._id,
        personalInfo: {
          fullName: 'Đỗ Văn E',
          dateOfBirth: new Date('2005-09-08'),
          gender: 'M',
          email: 'dovane@email.com',
          phoneNumber: '0945678901',
          address: 'Hà Nội'
        },
        academicInfo: {
          highSchoolName: 'THPT Kim Liên',
          graduationYear: 2024,
          gpa: 7.5,
          mathScore: 7.0,
          physicsScore: 7.5,
          chemistryScore: 7.8
        },
        admissionResult: {
          status: 'rejected',
          totalScore: 7.43
        },
        processStatus: 'completed',
        completionPercentage: 100,
        isActive: true
      }
    ]);

    res.json({
      message: 'Seed data thành công',
      data: {
        admin: adminUser.email,
        password: 'admin123',
        schools: schools.length,
        majors: majors.length,
        blocks: blocks.length,
        applications: applications.length
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Lỗi khi seed dữ liệu', details: (error as any).message });
  }
});

export default router;
