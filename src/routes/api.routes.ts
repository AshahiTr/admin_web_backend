import express from 'express';
import { School, Major, AdmissionBlock, Quota, Application, Statistics } from '../models/mongoose.models.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { getPaginationParams, getPaginatedResponse, buildFilter } from '../utils/helpers.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

// Schools
router.get('/schools', async (req, res) => {
  try {
    const schools = await School.find({ isActive: true });
    res.json(schools);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách trường' });
  }
});

router.post('/schools', authenticateToken, authorizeRole('admin', 'manager'), async (req, res) => {
  try {
    const school = await School.create(req.body);
    res.status(201).json(school);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tạo trường' });
  }
});

router.put('/schools/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(school);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật trường' });
  }
});

router.delete('/schools/:id', authenticateToken, authorizeRole('admin', 'manager'), async (req, res) => {
  try {
    await School.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi xóa trường' });
  }
});

// Majors
router.get('/schools/:schoolId/majors', async (req, res) => {
  try {
    const majors = await Major.find({ schoolId: req.params.schoolId, isActive: true });
    res.json(majors);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách ngành' });
  }
});

router.post('/majors', authenticateToken, authorizeRole('admin', 'manager'), async (req, res) => {
  try {
    const major = await Major.create(req.body);
    res.status(201).json(major);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi tạo ngành' });
  }
});

// Applications
router.get('/applications', async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit);
    const filter = buildFilter(req.query);
    
    const [applications, total] = await Promise.all([
      Application.find(filter).skip(skip).limit(limit).populate('schoolId majorId'),
      Application.countDocuments(filter)
    ]);
    
    res.json(getPaginatedResponse(applications, total, page, limit));
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách hồ sơ' });
  }
});

router.put('/applications/:id/status', authenticateToken, authorizeRole('admin', 'manager', 'staff'), async (req, res) => {
  try {
    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { 'admissionResult.status': req.body.status },
      { new: true }
    );
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái' });
  }
});

// Statistics
router.get('/statistics/dashboard', async (req, res) => {
  try {
    const totalSchools = await School.countDocuments({ isActive: true });
    const totalMajors = await Major.countDocuments({ isActive: true });
    const totalApplications = await Application.countDocuments();
    const pendingApplications = await Application.countDocuments({ 'admissionResult.status': 'pending' });
    const acceptedApplications = await Application.countDocuments({ 'admissionResult.status': 'accepted' });
    const rejectedApplications = await Application.countDocuments({ 'admissionResult.status': 'rejected' });
    
    res.json({
      totalSchools,
      totalMajors,
      totalApplications,
      pendingApplications,
      acceptedApplications,
      rejectedApplications
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy thống kê' });
  }
});

export default router;