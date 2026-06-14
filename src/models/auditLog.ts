import mongoose from 'mongoose';

export interface IAuditLog extends mongoose.Document {
  userId?: string;
  action: string;
  resource: string;
  description: string;
  ipAddress?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  createdAt: Date;
}

const AuditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    userId: { type: String },
    action: { type: String, required: true }, // login, logout, register, update_password, etc.
    resource: { type: String, required: true }, // users, schools, applications, etc.
    description: { type: String, required: true },
    ipAddress: String,
    status: { type: String, enum: ['success', 'failure'], required: true },
    errorMessage: String
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export const logAudit = async (
  userId: string | undefined,
  action: string,
  resource: string,
  description: string,
  status: 'success' | 'failure',
  ipAddress?: string,
  errorMessage?: string
) => {
  try {
    await AuditLog.create({
      userId,
      action,
      resource,
      description,
      status,
      ipAddress,
      errorMessage
    });
  } catch (error) {
    console.error('Lỗi ghi audit log:', error);
  }
};
