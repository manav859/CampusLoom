import { Student } from './student.model.js';

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
 *
 * Idempotent — if a student already exists for the given admissionId, the
 * existing record is returned without modification.
 */
export async function createStudentFromAdmission(admission) {
  const existingStudent = await Student.findOne({ admissionId: admission._id }).lean();

  if (existingStudent) {
    return mapStudentListItem(existingStudent);
  }

  const student = await Student.create({
    name: admission.name,
    email: admission.email,
    phone: admission.phone,
    class: admission.class,
    admissionId: admission._id,
    userId: admission.userId ?? null,
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
