import mongoose from 'mongoose';
import '../roles/role.model.js';

const userSchema = new mongoose.Schema(
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
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      // Passwords shouldn't be selected by default to prevent accidental leaks
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'student', 'teacher'],
      required: true,
      index: true,
    },
    // Legacy relation kept temporarily so existing admin accounts continue to authenticate
    // while the system moves to the direct `role` field.
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// email uniqueness is handled by the 'unique' property in the schema definition
userSchema.index({ role: 1, email: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
