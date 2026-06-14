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

export const AdmissionBlock = mongoose.model<IAdmissionBlock>('AdmissionBlock', AdmissionBlockSchema);

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
    admissionBlockId: { type: Schema.Types.ObjectId, ref: 'AdmissionBlock', required: true },
    majorId: { type: Schema.Types.ObjectId, ref: 'Major', required: true },
    quota: { type: Number, required: true, min: 0 },
    enrolled: { type: Number, default: 0, min: 0 },
    available: { type: Number, required: true },
    year: { type: Number, required: true },
    priority: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const Quota = mongoose.model<IQuota>('Quota', QuotaSchema);

// ============= Applications =============
export interface IApplication extends Document {
  applicationNumber: string;
  admissionBlockId: mongoose.Types.ObjectId;
  majorId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  personalInfo: {
    fullName: string;
    dateOfBirth?: Date;
    gender?: string;
    nationalId?: string;
    phoneNumber?: string;
    email?: string;
    address?: string;
    hometown?: string;
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
    status: string;
    resultDate?: Date;
    note?: string;
  };
  processStatus: string;
  completionPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    applicationNumber: { type: String, required: true, unique: true, trim: true },
    admissionBlockId: { type: Schema.Types.ObjectId, ref: 'AdmissionBlock', required: true },
    majorId: { type: Schema.Types.ObjectId, ref: 'Major', required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', required: true },
    personalInfo: {
      fullName: { type: String, required: true, trim: true },
      dateOfBirth: Date,
      gender: String,
      nationalId: String,
      phoneNumber: String,
      email: String,
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
      status: { type: String, default: 'pending' },
      resultDate: Date,
      note: String
    },
    processStatus: { type: String, default: 'submitted' },
    completionPercentage: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

// ============= Users =============
export interface IUser extends Document {
  username: string;
  email: string;
  hashedPassword: string;
  fullName: string;
  role: string;
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
    role: { type: String, default: 'viewer' },
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
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

// ============= Statistics =============
export interface IStatistics extends Document {
  type: string;
  date: Date;
  schoolId?: mongoose.Types.ObjectId;
  metrics: any;
  majorStats: any[];
  createdAt: Date;
}

const StatisticsSchema = new Schema<IStatistics>(
  {
    type: { type: String, required: true },
    date: { type: Date, required: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School' },
    metrics: { type: Schema.Types.Mixed, default: {} },
    majorStats: { type: Schema.Types.Mixed, default: [] }  // Sửa dòng này
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Statistics = mongoose.model<IStatistics>('Statistics', StatisticsSchema);

// ============= File Metadata =============
export interface IFileMetadata extends Document {
  gridFsId: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  category: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedFor: {
    type: string;
    id: mongoose.Types.ObjectId;
  };
  uploadDate: Date;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FileMetadataSchema = new Schema<IFileMetadata>(
  {
    gridFsId: { type: String, required: true },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    category: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedFor: {
      type: { type: String, required: true },
      id: { type: Schema.Types.ObjectId, required: true }
    },
    uploadDate: { type: Date, default: Date.now },
    isPublic: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const FileMetadata = mongoose.model<IFileMetadata>('FileMetadata', FileMetadataSchema);