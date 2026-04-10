import mongoose from 'mongoose';

const admissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
    },
    class: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'in_review', 'approved', 'rejected'],
      default: 'new',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

admissionSchema.index({ status: 1, createdAt: -1 });
admissionSchema.index({ email: 1, phone: 1, class: 1, createdAt: -1 });
admissionSchema.index({ userId: 1, createdAt: -1 });

export const Admission = mongoose.models.Admission || mongoose.model('Admission', admissionSchema);
