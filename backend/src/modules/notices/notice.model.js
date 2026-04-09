import mongoose from 'mongoose';

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['general', 'exam', 'holiday', 'urgent'],
      default: 'general',
      index: true,
    },
    publishDate: {
      type: Date,
      required: true,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

noticeSchema.index({ isActive: 1, publishDate: -1, expiryDate: 1 });
noticeSchema.index({ type: 1, publishDate: -1 });

export const Notice = mongoose.models.Notice || mongoose.model('Notice', noticeSchema);
