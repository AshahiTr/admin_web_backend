import mongoose from 'mongoose';

// MongoDB Connection Configuration

export const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variable
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Connect to MongoDB
    await mongoose.connect(mongoUri, {
      maxPoolSize: 50,
      minPoolSize: 10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });

    console.log('✅ Connected to MongoDB Atlas');

    // Handle connection events
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Disconnected from MongoDB');
    });

    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Disconnect from MongoDB
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
};

// ===== EXAMPLE: .env file structure =====
/*
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://admission_api:your_password@cluster0.xxxxx.mongodb.net/admission_system?retryWrites=true&w=majority

# Alternative: Local MongoDB (for development)
# MONGODB_URI=mongodb://localhost:27017/admission_system

# Server Configuration
PORT=5000
NODE_ENV=development
*/

// ===== EXAMPLE: Initialize MongoDB with collections and indexes =====
export const initializeDatabase = async () => {
  try {
    // Collections will be created automatically when first document is inserted
    // But we can create indexes explicitly for better performance

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error('Database connection not established');
    }

    // Create indexes for frequently queried fields
    await db.collection('schools').createIndex({ code: 1 }, { unique: true });
    await db.collection('schools').createIndex({ isActive: 1 });

    await db.collection('majors').createIndex({ schoolId: 1 });
    await db.collection('majors').createIndex({ code: 1 });
    await db.collection('majors').createIndex({ schoolId: 1, isActive: 1 });

    await db.collection('admissionblocks').createIndex({ majorId: 1 });
    await db
      .collection('admissionblocks')
      .createIndex({ year: 1, majorId: 1 });

    await db
      .collection('applications')
      .createIndex({ applicationNumber: 1 }, { unique: true });
    await db.collection('applications').createIndex({ admissionBlockId: 1 });
    await db.collection('applications').createIndex({ majorId: 1 });
    await db.collection('applications').createIndex({ schoolId: 1 });
    await db
      .collection('applications')
      .createIndex({ 'personalInfo.email': 1 });
    await db
      .collection('applications')
      .createIndex({ 'admissionResult.status': 1 });
    await db
      .collection('applications')
      .createIndex({ 'admissionResult.totalScore': -1 });
    await db.collection('applications').createIndex({ createdAt: -1 });

    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });

    await db.collection('documents').createIndex({ applicationId: 1 });
    await db
      .collection('documents')
      .createIndex({ documentType: 1, applicationId: 1 });

    await db
      .collection('statistics')
      .createIndex({ type: 1, date: -1 });
    await db
      .collection('statistics')
      .createIndex({ schoolId: 1, type: 1 });

    await db
      .collection('notifications')
      .createIndex({ recipientId: 1, isRead: 1 });
    await db
      .collection('notifications')
      .createIndex({ createdAt: -1 });

    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

// ===== EXAMPLE: Seed sample data (for development) =====
export const seedDatabase = async () => {
  try {
    const {
      School,
      Major,
      AdmissionBlock,
      User
    } = await import('../models/mongoose.models');

    // Check if data already exists
    const schoolCount = await School.countDocuments();
    if (schoolCount > 0) {
      console.log('Database already seeded. Skipping seed operation.');
      return;
    }

    // Create sample schools
    const schools = await School.insertMany([
      {
        code: 'HUST',
        name: 'Đại học Bách Khoa Hà Nội',
        description: 'Trường hàng đầu về kỹ thuật',
        address: 'Hà Nội, Việt Nam',
        email: 'admission@hust.edu.vn',
        isActive: true
      },
      {
        code: 'NUS',
        name: 'Đại học Quốc gia Hà Nội',
        description: 'Trường đại học Quốc gia',
        address: 'Hà Nội, Việt Nam',
        email: 'admission@nus.edu.vn',
        isActive: true
      }
    ]);

    console.log('✅ Sample schools created:', schools.length);

    // Create sample majors
    const majors = await Major.insertMany([
      {
        schoolId: schools[0]._id,
        code: '7480201',
        name: 'Công Nghệ Thông Tin',
        description: 'Ngành học tập trong lĩnh vực công nghệ thông tin',
        tuitionPerSemester: 2000000,
        duration: 4,
        studyForm: 'fulltime',
        isActive: true
      },
      {
        schoolId: schools[0]._id,
        code: '7480202',
        name: 'An Toàn Thông Tin',
        description: 'Ngành chuyên về bảo mật thông tin',
        tuitionPerSemester: 2000000,
        duration: 4,
        studyForm: 'fulltime',
        isActive: true
      }
    ]);

    console.log('✅ Sample majors created:', majors.length);

    // Create sample admission blocks
    const blocks = await AdmissionBlock.insertMany([
      {
        majorId: majors[0]._id,
        code: 'A00',
        name: 'Khối Toán - Vật Lý - Hóa',
        subjects: ['Toán', 'Vật Lý', 'Hóa Học'],
        year: 2025,
        isActive: true
      },
      {
        majorId: majors[0]._id,
        code: 'A01',
        name: 'Khối Toán - Vật Lý - Tiếng Anh',
        subjects: ['Toán', 'Vật Lý', 'Tiếng Anh'],
        year: 2025,
        isActive: true
      }
    ]);

    console.log('✅ Sample admission blocks created:', blocks.length);

    // Create sample users
    const bcrypt = require('bcrypt');
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@admission.vn',
      hashedPassword: await bcrypt.hash('admin123', 10),
      fullName: 'Administrator',
      role: 'admin',
      schoolId: [schools[0]._id],
      permissions: {
        canCreateSchool: true,
        canEditSchool: true,
        canDeleteSchool: true,
        canManageMajors: true,
        canManageAdmissionBlocks: true,
        canReviewApplications: true,
        canExportData: true
      },
      isActive: true
    });

    console.log('✅ Sample admin user created');
    console.log('\n📝 Seed data created successfully!');
    console.log('Test credentials: admin / admin123');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
};
