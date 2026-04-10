import mongoose from 'mongoose';

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    marks: {
      type: Number,
      required: true,
      min: 0,
    },
    maxMarks: {
      type: Number,
      required: true,
      min: 1,
    },
    examType: {
      type: String,
      required: true,
      enum: ['midterm', 'final', 'unit_test', 'practical'],
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

resultSchema.index({ studentId: 1, examType: 1 });
resultSchema.index({ studentId: 1, subject: 1, examType: 1 }, { unique: true });

export const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);
