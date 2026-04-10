import { User } from '../auth/user.model.js';
import { Student } from '../students/student.model.js';
import { getStudentByUserId } from '../students/students.service.js';

export async function getContacts(user) {
  if (user.role === 'student') {
    // Return all teachers for now
    const teachers = await User.find({ role: 'teacher' }).select('name email').lean();
    return teachers.map(t => ({
      id: t._id.toString(),
      name: t.name,
      email: t.email,
      role: 'teacher',
    }));
  }

  if (user.role === 'teacher') {
    // Return all students for now (Can be filtered by assigned classes later)
    const students = await Student.find().select('name rollNumber class userId').lean();
    // Only return students who have a linked User account so they can chat
    return students
      .filter(s => s.userId)
      .map(s => ({
        id: s.userId.toString(),
        name: s.name,
        rollNumber: s.rollNumber,
        class: s.class,
        role: 'student',
      }));
  }

  return [];
}
