import { Timetable } from './timetable.model.js';

export async function createTimetableEntry(payload) {
  const entry = await Timetable.create(payload);
  return entry;
}

export async function getTimetable(filters = {}) {
  const query = {};
  if (filters.class) query.class = filters.class;
  if (filters.day) query.day = filters.day;
  if (filters.teacherId) query.teacherId = filters.teacherId;

  const entries = await Timetable.find(query)
    .sort({ day: 1, period: 1 })
    .populate('teacherId', 'name email')
    .lean();

  return entries.map(e => ({
    id: e._id.toString(),
    class: e.class,
    day: e.day,
    subject: e.subject,
    period: e.period,
    startTime: e.startTime,
    endTime: e.endTime,
    teacher: e.teacherId ? { id: e.teacherId._id.toString(), name: e.teacherId.name, email: e.teacherId.email } : null,
  }));
}

export async function deleteTimetableEntry(id) {
  await Timetable.findByIdAndDelete(id);
  return { id };
}
