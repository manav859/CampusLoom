import bcrypt from 'bcrypt';
import { Student } from './student.model.js';
import { User } from '../users/user.model.js';
import { USER_ROLES } from '../auth/auth.constants.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function mapStudentListItem(student) {
  return {
    id: student._id.toString(),
    name: student.name,
    email: student.email,
    phone: student.phone,
    class: student.class,
    admissionId: student.admissionId.toString(),
    userId: student.userId?.toString() ?? null,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

/**
 * Create a Student record from an approved Admission.
 * Automatically creates a User account if one doesn't exist.
 */
export async function createStudentFromAdmission(admission) {
  const existingStudent = await Student.findOne({ admissionId: admission._id }).lean();

  if (existingStudent) {
    return mapStudentListItem(existingStudent);
  }

  let finalUserId = admission.userId;

  // Automate User Creation
  if (!finalUserId) {
    // Check if user exists by email just in case
    let existingUser = await User.findOne({ email: admission.email }).lean();
    
    if (!existingUser) {
      const defaultPassword = await bcrypt.hash('password123', 10);
      existingUser = await User.create({
        name: admission.name,
        email: admission.email.toLowerCase(),
        password: defaultPassword,
        role: USER_ROLES.STUDENT,
        isActive: true,
      });
    }
    finalUserId = existingUser._id;

    // Update the admission to link this new user
    if (admission.userId !== finalUserId) {
      admission.userId = finalUserId;
      await admission.save();
    }
  }

  const student = await Student.create({
    name: admission.name,
    email: admission.email,
    phone: admission.phone,
    class: admission.class,
    admissionId: admission._id,
    userId: finalUserId,
  });

  return mapStudentListItem(student);
}

export async function listStudents(filters = {}) {
  const query = {};

  if (filters.class) {
    query.class = filters.class;
  }

  const students = await Student.find(query).sort({ createdAt: -1 }).lean();

  return students.map(mapStudentListItem);
}

export async function getStudentById(studentId) {
  const student = await Student.findById(studentId).lean();

  if (!student) {
    throw createHttpError(404, 'Student not found');
  }

  return mapStudentListItem(student);
}

export async function deleteStudent(studentId) {
  const student = await Student.findByIdAndDelete(studentId).lean();

  if (!student) {
    throw createHttpError(404, 'Student not found');
  }

  return { id: student._id.toString() };
}

export async function getStudentByUserId(userId) {
  const student = await Student.findOne({ userId }).lean();

  return student ? mapStudentListItem(student) : null;
}
