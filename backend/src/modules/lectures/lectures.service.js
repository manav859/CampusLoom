import { Lecture } from './lecture.model.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function createLecture(payload, user) {
  const lecture = await Lecture.create({
    ...payload,
    uploadedBy: user.id,
  });

  return {
    id: lecture._id.toString(),
    title: lecture.title,
    videoUrl: lecture.videoUrl,
    subject: lecture.subject,
    class: lecture.class,
    uploadedBy: lecture.uploadedBy.toString(),
    createdAt: lecture.createdAt,
  };
}

export async function listLectures(filters = {}) {
  const query = {};
  if (filters.class) query.class = filters.class;
  if (filters.subject) query.subject = filters.subject;

  const lectures = await Lecture.find(query)
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name')
    .lean();

  return lectures.map(l => ({
    id: l._id.toString(),
    title: l.title,
    videoUrl: l.videoUrl,
    subject: l.subject,
    class: l.class,
    uploadedBy: l.uploadedBy ? { id: l.uploadedBy._id.toString(), name: l.uploadedBy.name } : null,
    createdAt: l.createdAt,
  }));
}

export async function deleteLecture(lectureId, user) {
  const lecture = await Lecture.findById(lectureId);
  if (!lecture) {
    throw createHttpError(404, 'Lecture not found');
  }

  if (user.role !== 'admin' && lecture.uploadedBy.toString() !== user.id) {
    throw createHttpError(403, 'Not authorized to delete this lecture');
  }

  await Lecture.findByIdAndDelete(lectureId);
  return { id: lectureId };
}
