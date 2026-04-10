import { Attendance } from './attendance.model.js';
import { Student } from '../students/student.model.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function markClassAttendance({ className, date, records }, user) {
  const teacherId = user.id;

  // We will upsert attendance records
  const bulkOps = records.map((record) => ({
    updateOne: {
      filter: { studentId: record.studentId, date },
      update: {
        $set: {
          studentId: record.studentId,
          class: className,
          date,
          status: record.status,
          markedBy: teacherId,
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await Attendance.bulkWrite(bulkOps);
  }

  return { success: true, count: records.length };
}

export async function getAttendanceByStudent(studentId, filters = {}) {
  const query = { studentId };
  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) query.date.$gte = filters.startDate;
    if (filters.endDate) query.date.$lte = filters.endDate;
  }

  const records = await Attendance.find(query).sort({ date: -1 }).lean();
  
  const presentCount = records.filter(r => r.status === 'present').length;
  const totalDays = records.length;
  const percentage = totalDays === 0 ? 0 : Math.round((presentCount / totalDays) * 100);

  return {
    records: records.map(r => ({
      id: r._id.toString(),
      date: r.date,
      status: r.status,
    })),
    summary: {
      present: presentCount,
      absent: totalDays - presentCount,
      total: totalDays,
      percentage,
    }
  };
}

export async function getAttendanceByClass(className, date) {
  // Get all students in the class
  const students = await Student.find({ class: className }).sort({ name: 1 }).lean();
  
  // Get attendance records for the class and date
  const records = await Attendance.find({ class: className, date }).lean();
  const recordMap = new Map(records.map(r => [r.studentId.toString(), r]));

  return students.map(student => {
    const record = recordMap.get(student._id.toString());
    return {
      studentId: student._id.toString(),
      name: student.name,
      status: record ? record.status : null, // null means not marked yet
    };
  });
}
