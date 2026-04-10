import { Attendance } from '../attendance/attendance.model.js';
import { Notice } from '../notices/notice.model.js';
import { Test } from '../tests/test.model.js';
import { Student } from '../students/student.model.js';
import { getStudentByUserId } from '../students/students.service.js';

export async function getStudentDashboardStats(userId) {
  const student = await getStudentByUserId(userId);
  if (!student) throw new Error('Student profile not found');

  // 1. Attendance %
  const attendanceRecords = await Attendance.find({ studentId: student.id }).lean();
  const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
  const attendancePercentage = attendanceRecords.length > 0 
    ? Math.round((presentCount / attendanceRecords.length) * 100) 
    : 0;

  // 2. Notices count
  const noticesCount = await Notice.countDocuments();

  // 3. Upcoming Tests count
  const today = new Date().toISOString().split('T')[0];
  const upcomingTestsCount = await Test.countDocuments({ 
    class: student.class,
    date: { $gte: today } 
  });

  return {
    attendancePercentage,
    noticesCount,
    upcomingTestsCount,
    class: student.class,
  };
}

export async function getTeacherDashboardStats(user) {
  // 1. Assigned classes count (unique classes from timetable)
  // 2. Upcoming sessions today
  // 3. Notices
  
  const noticesCount = await Notice.countDocuments();
  
  // For teacher, we'd ideally check their timetable
  // For now, let's use fixed or placeholder logic until timetable is populated
  return {
    assignedClassesCount: 4, 
    upcomingSessionsToday: 3,
    noticesCount,
    attendancePendingCount: 2,
  };
}
