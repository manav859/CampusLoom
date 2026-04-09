import { Notice } from './notice.model.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeNoticeText(value) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function mapCreatedBy(createdBy) {
  if (!createdBy) {
    return null;
  }

  return {
    id: createdBy._id.toString(),
    email: createdBy.email,
  };
}

function mapAdminNotice(notice) {
  return {
    id: notice._id.toString(),
    title: notice.title,
    content: notice.content,
    type: notice.type,
    publishDate: notice.publishDate,
    expiryDate: notice.expiryDate,
    isActive: notice.isActive,
    createdBy: mapCreatedBy(notice.createdBy),
    createdAt: notice.createdAt,
    updatedAt: notice.updatedAt,
  };
}

function mapPublicNotice(notice) {
  return {
    id: notice._id.toString(),
    title: notice.title,
    content: notice.content,
    type: notice.type,
    publishDate: notice.publishDate,
    expiryDate: notice.expiryDate,
    createdAt: notice.createdAt,
  };
}

async function findNoticeByIdOrThrow(noticeId) {
  const notice = await Notice.findById(noticeId).populate('createdBy', 'email').exec();

  if (!notice) {
    throw createHttpError(404, 'Notice not found');
  }

  return notice;
}

function assertValidSchedule(publishDate, expiryDate) {
  if (expiryDate && expiryDate <= publishDate) {
    throw createHttpError(400, 'Expiry date must be after publish date');
  }
}

function buildPublicVisibilityFilter(now = new Date()) {
  return {
    isActive: true,
    publishDate: { $lte: now },
    $or: [{ expiryDate: null }, { expiryDate: { $exists: false } }, { expiryDate: { $gte: now } }],
  };
}

export async function listNotices() {
  const notices = await Notice.find()
    .sort({ publishDate: -1, createdAt: -1 })
    .populate('createdBy', 'email')
    .lean();

  return notices.map(mapAdminNotice);
}

export async function getNoticeById(noticeId) {
  const notice = await Notice.findById(noticeId).populate('createdBy', 'email').lean();

  if (!notice) {
    throw createHttpError(404, 'Notice not found');
  }

  return mapAdminNotice(notice);
}

export async function createNotice(payload, createdByUserId) {
  assertValidSchedule(payload.publishDate, payload.expiryDate ?? null);

  const notice = await Notice.create({
    title: normalizeNoticeText(payload.title),
    content: normalizeNoticeText(payload.content),
    type: payload.type,
    publishDate: payload.publishDate,
    expiryDate: payload.expiryDate ?? null,
    isActive: payload.isActive ?? true,
    createdBy: createdByUserId,
  });

  const savedNotice = await Notice.findById(notice._id).populate('createdBy', 'email').lean();

  return mapAdminNotice(savedNotice);
}

export async function updateNotice(noticeId, payload) {
  const notice = await findNoticeByIdOrThrow(noticeId);
  const nextPublishDate = payload.publishDate ?? notice.publishDate;
  const nextExpiryDate = payload.expiryDate !== undefined ? payload.expiryDate : notice.expiryDate;

  assertValidSchedule(nextPublishDate, nextExpiryDate);

  if (payload.title !== undefined) {
    notice.title = normalizeNoticeText(payload.title);
  }

  if (payload.content !== undefined) {
    notice.content = normalizeNoticeText(payload.content);
  }

  if (payload.type !== undefined) {
    notice.type = payload.type;
  }

  if (payload.publishDate !== undefined) {
    notice.publishDate = payload.publishDate;
  }

  if (payload.expiryDate !== undefined) {
    notice.expiryDate = payload.expiryDate ?? null;
  }

  if (payload.isActive !== undefined) {
    notice.isActive = payload.isActive;
  }

  await notice.save();
  await notice.populate('createdBy', 'email');

  return mapAdminNotice(notice);
}

export async function deleteNotice(noticeId) {
  const notice = await findNoticeByIdOrThrow(noticeId);

  await notice.deleteOne();

  return {
    id: notice._id.toString(),
  };
}

export async function updateNoticeStatus(noticeId, isActive) {
  const notice = await findNoticeByIdOrThrow(noticeId);
  notice.isActive = isActive;

  await notice.save();
  await notice.populate('createdBy', 'email');

  return mapAdminNotice(notice);
}

export async function listPublicNotices() {
  const notices = await Notice.find(buildPublicVisibilityFilter())
    .sort({ publishDate: -1, createdAt: -1 })
    .lean();

  return notices.map(mapPublicNotice);
}
