import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema(
  {
    class: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    period: {
      type: Number, // 1st, 2nd, etc.
      required: true,
    },
    startTime: {
      type: String, // e.g. "08:00"
      required: true,
    },
    endTime: {
      type: String, // e.g. "09:00"
      required: true,
    },
    teacherId: {
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

// A teacher can only be in one place at a time
timetableSchema.index({ teacherId: 1, day: 1, period: 1 }, { unique: true });
// A class can only have one subject at a time
timetableSchema.index({ class: 1, day: 1, period: 1 }, { unique: true });

export const Timetable = mongoose.models.Timetable || mongoose.model('Timetable', timetableSchema);
