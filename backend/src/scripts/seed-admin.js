import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'mongodb://localhost:27017/schoolos';
const SALT_ROUNDS = 10;

async function seedAdmin() {
  try {
    console.log('🌱 Starting admin seeding...');
    await mongoose.connect(DATABASE_URL);
    console.log('📦 Connected to MongoDB');

    // Define User Schema (minimal for seeding)
    const userSchema = new mongoose.Schema({
      name: String,
      email: { type: String, unique: true },
      password: { type: String, select: false },
      role: { type: String, enum: ['admin', 'student', 'teacher'] },
      isActive: { type: Boolean, default: true }
    });

    const User = mongoose.models.User || mongoose.model('User', userSchema);

    const adminEmail = 'admin@campusloom.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('✅ Admin user already exists:', adminEmail);
    } else {
      const hashedPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
      await User.create({
        name: 'System Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      console.log('✨ Admin user created successfully!');
      console.log('📧 Email: admin@campusloom.com');
      console.log('🔑 Password: admin123');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedAdmin();
