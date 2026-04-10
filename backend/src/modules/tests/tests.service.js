import { Test, TestResult } from './test.model.js';
import { Student } from '../students/student.model.js';

export async function createTest(payload, user) {
  const test = await Test.create({
    ...payload,
    createdBy: user.id,
  });
  return test;
}

export async function submitResults(testId, results) {
  const bulkOps = results.map(r => ({
    updateOne: {
      filter: { testId, studentId: r.studentId },
      update: { $set: { marks: r.marks } },
      upsert: true,
    }
  }));
  
  await TestResult.bulkWrite(bulkOps);
  return { success: true };
}

export async function getTestsByClass(className) {
  const tests = await Test.find({ class: className }).sort({ date: -1 }).lean();
  return tests.map(t => ({
    id: t._id.toString(),
    title: t.title,
    subject: t.subject,
    date: t.date,
    maxMarks: t.maxMarks,
  }));
}

export async function getStudentResults(studentId) {
  const results = await TestResult.find({ studentId })
    .populate('testId')
    .sort({ createdAt: -1 })
    .lean();
    
  return results.map(r => ({
    id: r._id.toString(),
    testTitle: r.testId?.title,
    subject: r.testId?.subject,
    date: r.testId?.date,
    marks: r.marks,
    maxMarks: r.testId?.maxMarks,
  }));
}

export async function getTestWithResults(testId) {
  const test = await Test.findById(testId).lean();
  if (!test) return null;
  
  const results = await TestResult.find({ testId }).lean();
  const resultMap = new Map(results.map(r => [r.studentId.toString(), r.marks]));
  
  const students = await Student.find({ class: test.class }).sort({ name: 1 }).lean();
  
  return {
    test: {
      id: test._id.toString(),
      title: test.title,
      class: test.class,
      subject: test.subject,
      date: test.date,
      maxMarks: test.maxMarks,
    },
    students: students.map(s => ({
      id: s._id.toString(),
      name: s.name,
      marks: resultMap.get(s._id.toString()) ?? null,
    }))
  };
}
