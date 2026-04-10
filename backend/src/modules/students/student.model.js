import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    class: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    admissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admission',
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

studentSchema.index({ class: 1, createdAt: -1 });
studentSchema.index({ userId: 1 }, { sparse: true });

export const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);
