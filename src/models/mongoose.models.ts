import mongoose, { Schema, Document } from 'mongoose';

// ============= Schools =============
export interface ISchool extends Document {
  code: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema = new Schema<ISchool>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: String,
    address: String,
    phone: String,
    email: String,
    website: String,
    logo: String,
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const School = mongoose.model<ISchool>('School', SchoolSchema);

// ============= Majors =============
export interface IMajor extends Document {
  schoolId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  tuitionPerSemester?: number;
  duration?: number;
  studyForm?: 'fulltime' | 'parttime' | 'distance';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MajorSchema = new Schema<IMajor>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: String,
    tuitionPerSemester: Number,
    duration: Number,
    studyForm: { type: String, enum: ['fulltime', 'parttime', 'distance'] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

MajorSchema.index({ schoolId: 1 });
MajorSchema.index({ code: 1 });
MajorSchema.index({ schoolId: 1, isActive: 1 });

export const Major = mongoose.model<IMajor>('Major', MajorSchema);

// ============= AdmissionBlocks =============
export interface IAdmissionBlock extends Document {
  majorId: mongoose.Types.ObjectId;
  code: string;
  name: string;
  subjects: string[];
  description?: string;
  year: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AdmissionBlockSchema = new Schema<IAdmissionBlock>(
  {
    majorId: { type: Schema.Types.ObjectId, ref: 'Major', required: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    subjects: [{ type: String, trim: true }],
    description: String,
    year: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

AdmissionBlockSchema.index({ majorId: 1 });
AdmissionBlockSchema.index({ code: 1 });
AdmissionBlockSchema.index({ year: 1, majorId: 1 });

export const AdmissionBlock = mongoose.model<IAdmissionBlock>(
  'AdmissionBlock',
  AdmissionBlockSchema
);

// ============= Quotas =============
export interface IQuota extends Document {
  admissionBlockId: mongoose.Types.ObjectId;
  majorId: mongoose.Types.ObjectId;
  quota: number;
  enrolled: number;
  available: number;
  year: number;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuotaSchema = new Schema<IQuota>(
  {
    admissionBlockId: {
      type: Schema.Types.ObjectId,
      ref: 'AdmissionBlock',
      required: true
    },
    majorId: { type: Schema.Types.ObjectId, ref: 'Major', required: true },
    quota: { type: Number, required: true, min: 0 },
    enrolled: { type: Number, default: 0, min: 0 },
    available: { type: Number, required: true },
    year: { type: Number, required: true },
    priority: { type: Number, default: 1 }
  },
  { timestamps: true }
);

QuotaSchema.index({ admissionBlockId: 1 });
QuotaSchema.index({ year: 1, majorId: 1 });

export const Quota = mongoose.model<IQuota>('Quota', QuotaSchema);

// ============= Applications =============
export interface IApplication extends Document {
  applicationNumber: string;
  admissionBlockId: mongoose.Types.ObjectId;
  majorId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  personalInfo: {
    fullName: string;
    dateOfBirth: Date;
    gender: 'M' | 'F';
    nationalId: string;
    phoneNumber: string;
    email: string;
    address: string;
    hometown: string;
  };
  academicInfo: {
    highSchoolCode?: string;
    highSchoolName?: string;
    graduationYear?: number;
    mathScore?: number;
    physicsScore?: number;
    chemistryScore?: number;
    biologyScore?: number;
    historicalScore?: number;
    geographyScore?: number;
    literatureScore?: number;
    englishScore?: number;
    specialScore?: number;
    gpa?: number;
  };
  admissionResult: {
    totalScore?: number;
    priorityPoints?: number;
    finalScore?: number;
    status: 'pending' | 'accepted' | 'rejected' | 'waitlisted';
    resultDate?: Date;
    note?: string;
  };
  processStatus: 'submitted' | 'verified' | 'scoring' | 'completed';
  completionPercentage: number;
  alternateChoices?: Array<{
    admissionBlockId: mongoose.Types.ObjectId;
    priority: number;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true, trim: true },
    admissionBlockId: {
      type: Schema.Types.ObjectId,
      ref: 'AdmissionBlock',
      required: true
    },
    majorId: { type: Schema.Types.ObjectId, ref: 'Major', required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    personalInfo: {
      fullName: { type: String, required: true, trim: true },
      dateOfBirth: Date,
      gender: { type: String, enum: ['M', 'F'] },
      nationalId: { type: String, trim: true },
      phoneNumber: String,
      email: { type: String, lowercase: true },
      address: String,
      hometown: String
    },
    academicInfo: {
      highSchoolCode: String,
      highSchoolName: String,
      graduationYear: Number,
      mathScore: Number,
      physicsScore: Number,
      chemistryScore: Number,
      biologyScore: Number,
      historicalScore: Number,
      geographyScore: Number,
      literatureScore: Number,
      englishScore: Number,
      specialScore: Number,
      gpa: Number
    },
    admissionResult: {
      totalScore: Number,
      priorityPoints: { type: Number, default: 0 },
      finalScore: Number,
      status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'waitlisted'],
        default: 'pending'
      },
      resultDate: Date,
      note: String
    },
    processStatus: {
      type: String,
      enum: ['submitted', 'verified', 'scoring', 'completed'],
      default: 'submitted'
    },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    alternateChoices: [
      {
        admissionBlockId: { type: Schema.Types.ObjectId, ref: 'AdmissionBlock' },
        priority: Number
      }
    ],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ApplicationSchema.index({ applicationNumber: 1 }, { unique: true });
ApplicationSchema.index({ admissionBlockId: 1 });
ApplicationSchema.index({ majorId: 1 });
ApplicationSchema.index({ schoolId: 1 });
ApplicationSchema.index({ 'personalInfo.email': 1 });
ApplicationSchema.index({ 'admissionResult.status': 1 });
ApplicationSchema.index({ 'admissionResult.totalScore': -1 });
ApplicationSchema.index({ createdAt: -1 });
ApplicationSchema.index({ admissionBlockId: 1, 'admissionResult.status': 1 });

export const Application = mongoose.model<IApplication>(
  'Application',
  ApplicationSchema
);

// ============= Users =============
export interface IUser extends Document {
  username: string;
  email: string;
  hashedPassword: string;
  fullName: string;
  role: 'admin' | 'staff' | 'manager' | 'viewer';
  schoolId: mongoose.Types.ObjectId[];
  permissions: {
    canCreateSchool: boolean;
    canEditSchool: boolean;
    canDeleteSchool: boolean;
    canManageMajors: boolean;
    canManageAdmissionBlocks: boolean;
    canReviewApplications: boolean;
    canExportData: boolean;
  };
  isActive: boolean;
  lastLogin?: Date;
  passwordResetCode?: string;
  passwordResetExpiry?: Date;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    hashedPassword: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['admin', 'staff', 'manager', 'viewer'],
      default: 'viewer'
    },
    schoolId: [{ type: Schema.Types.ObjectId, ref: 'School' }],
    permissions: {
      canCreateSchool: { type: Boolean, default: false },
      canEditSchool: { type: Boolean, default: false },
      canDeleteSchool: { type: Boolean, default: false },
      canManageMajors: { type: Boolean, default: false },
      canManageAdmissionBlocks: { type: Boolean, default: false },
      canReviewApplications: { type: Boolean, default: false },
      canExportData: { type: Boolean, default: false }
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    passwordResetCode: String,
    passwordResetExpiry: Date,
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

// Xóa index idCard_1 nếu nó tồn tại (Sửa lỗi Duplicate Key idCard: null)
mongoose.connection.on('open', async () => {
  try {
    const collections = await mongoose.connection.db.listCollections({ name: 'users' }).toArray();
    if (collections.length > 0) {
      await mongoose.connection.db.collection('users').dropIndex('idCard_1').catch(() => {});
    }
  } catch (e) {
    // Bỏ qua nếu index không tồn tại
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);

// ============= Documents =============
export interface IDocument extends Document {
  applicationId: mongoose.Types.ObjectId;
  documentType: 'transcript' | 'certificate' | 'passport' | 'photo' | 'other';
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: mongoose.Types.ObjectId;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: true
    },
    documentType: {
      type: String,
      enum: ['transcript', 'certificate', 'passport', 'photo', 'other'],
      required: true
    },
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    mimeType: String,
    fileSize: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isVerified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

DocumentSchema.index({ applicationId: 1 });
DocumentSchema.index({ documentType: 1, applicationId: 1 });

export const Document = mongoose.model<IDocument>('Document', DocumentSchema);

// ============= Statistics =============
export interface IStatistics extends Document {
  type: 'daily' | 'monthly' | 'yearly';
  date: Date;
  schoolId?: mongoose.Types.ObjectId;
  metrics: {
    totalApplications: number;
    acceptedApplications: number;
    rejectedApplications: number;
    waitlistedApplications: number;
    pendingApplications: number;
    averageScore: number;
    scoreDistribution: {
      '0-5': number;
      '5-10': number;
      '10-15': number;
      '15-20': number;
      '20-25': number;
      '25+': number;
    };
  };
  majorStats: Array<{
    majorId: mongoose.Types.ObjectId;
    applications: number;
    accepted: number;
    ratio: number;
  }>;
  createdAt: Date;
}

const StatisticsSchema = new Schema<IStatistics>(
  {
    type: { type: String, enum: ['daily', 'monthly', 'yearly'], required: true },
    date: { type: Date, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School' },
    metrics: {
      totalApplications: { type: Number, default: 0 },
      acceptedApplications: { type: Number, default: 0 },
      rejectedApplications: { type: Number, default: 0 },
      waitlistedApplications: { type: Number, default: 0 },
      pendingApplications: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      scoreDistribution: {
        '0-5': { type: Number, default: 0 },
        '5-10': { type: Number, default: 0 },
        '10-15': { type: Number, default: 0 },
        '15-20': { type: Number, default: 0 },
        '20-25': { type: Number, default: 0 },
        '25+': { type: Number, default: 0 }
      }
    },
    majorStats: [
      {
        majorId: { type: Schema.Types.ObjectId, ref: 'Major' },
        applications: Number,
        accepted: Number,
        ratio: Number
      }
    ]
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

StatisticsSchema.index({ type: 1, date: -1 });
StatisticsSchema.index({ schoolId: 1, type: 1 });

export const Statistics = mongoose.model<IStatistics>(
  'Statistics',
  StatisticsSchema
);

// ============= Notifications =============
export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  relatedId?: mongoose.Types.ObjectId;
  relatedType?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedId: { type: Schema.Types.ObjectId },
    relatedType: String,
    isRead: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);

// ============= File Metadata =============
export interface IFileMetadata extends Document {
  gridFsId: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  category: 'avatar' | 'document' | 'logo' | 'data';
  uploadedBy: mongoose.Types.ObjectId;
  uploadedFor: {
    type: 'user' | 'application' | 'school';
    id: mongoose.Types.ObjectId;
  };
  uploadDate: Date;
  expiryDate?: Date;
  isPublic: boolean;
  metadata?: {
    applicationId?: mongoose.Types.ObjectId;
    userId?: mongoose.Types.ObjectId;
    schoolId?: mongoose.Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FileMetadataSchema = new Schema<IFileMetadata>(
  {
    gridFsId: { type: String, required: true },
    originalName: { type: String, required: true, trim: true },
    filename: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    category: {
      type: String,
      enum: ['avatar', 'document', 'logo', 'data'],
      required: true
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedFor: {
      type: {
        type: String,
        enum: ['user', 'application', 'school'],
        required: true
      },
      id: { type: Schema.Types.ObjectId, required: true }
    },
    uploadDate: { type: Date, default: Date.now },
    expiryDate: Date,
    isPublic: { type: Boolean, default: false },
    metadata: {
      applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      schoolId: { type: Schema.Types.ObjectId, ref: 'School' }
    }
  },
  { timestamps: true }
);

FileMetadataSchema.index({ uploadedBy: 1 });
FileMetadataSchema.index({ 'uploadedFor.id': 1 });
FileMetadataSchema.index({ category: 1 });
FileMetadataSchema.index({ uploadDate: -1 });
FileMetadataSchema.index({ expiryDate: 1 });

export const FileMetadata = mongoose.model<IFileMetadata>(
  'FileMetadata',
  FileMetadataSchema
);
