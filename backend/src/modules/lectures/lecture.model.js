import mongoose from 'mongoose';

const lectureSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    class: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    uploadedBy: {
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

lectureSchema.index({ class: 1, subject: 1, createdAt: -1 });

export const Lecture = mongoose.models.Lecture || mongoose.model('Lecture', lectureSchema);
