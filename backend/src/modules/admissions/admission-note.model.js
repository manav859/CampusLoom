import mongoose from 'mongoose';

const admissionNoteSchema = new mongoose.Schema(
  {
    admissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admission',
      required: true,
      index: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

admissionNoteSchema.index({ admissionId: 1, createdAt: -1 });

export const AdmissionNote =
  mongoose.models.AdmissionNote || mongoose.model('AdmissionNote', admissionNoteSchema);
