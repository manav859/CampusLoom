import { Result } from './result.model.js';
import { Student } from '../students/student.model.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function mapResult(result) {
  return {
    id: result._id.toString(),
    studentId: result.studentId.toString(),
    subject: result.subject,
    marks: result.marks,
    maxMarks: result.maxMarks,
    examType: result.examType,
    createdAt: result.createdAt,
  };
}

export async function createResult(payload) {
  const studentExists = await Student.exists({ _id: payload.studentId });

  if (!studentExists) {
    throw createHttpError(404, 'Student not found');
  }

  const duplicate = await Result.findOne({
    studentId: payload.studentId,
    subject: payload.subject,
    examType: payload.examType,
  }).lean();

  if (duplicate) {
    throw createHttpError(409, `A ${payload.examType} result for "${payload.subject}" already exists for this student`);
  }

  const result = await Result.create({
    studentId: payload.studentId,
    subject: payload.subject.trim(),
    marks: payload.marks,
    maxMarks: payload.maxMarks,
    examType: payload.examType,
  });

  return mapResult(result);
}

export async function getResultsByStudentId(studentId) {
  const studentExists = await Student.exists({ _id: studentId });

  if (!studentExists) {
    throw createHttpError(404, 'Student not found');
  }

  const results = await Result.find({ studentId })
    .sort({ examType: 1, subject: 1 })
    .lean();

  return results.map(mapResult);
}

export async function getResultsForUser(userId) {
  const student = await Student.findOne({ userId }).lean();

  if (!student) {
    return [];
  }

  const results = await Result.find({ studentId: student._id })
    .sort({ examType: 1, subject: 1 })
    .lean();

  return results.map(mapResult);
}
