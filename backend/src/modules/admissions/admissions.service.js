import { Admission } from './admission.model.js';
import { AdmissionNote } from './admission-note.model.js';
import { USER_ROLES } from '../auth/auth.constants.js';
import { createStudentFromAdmission } from '../students/students.service.js';

const RECENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

function normalizeSingleLineText(value) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMultilineText(value) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function normalizeEmail(value) {
  return normalizeSingleLineText(value).toLowerCase();
}

function normalizePhone(value) {
  return normalizeSingleLineText(value)
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '');
}

function mapNoteAuthor(createdBy) {
  if (!createdBy) {
    return null;
  }

  return {
    id: createdBy._id.toString(),
    email: createdBy.email,
  };
}

function mapAdmissionListItem(admission) {
  return {
    id: admission._id.toString(),
    name: admission.name,
    phone: admission.phone,
    email: admission.email,
    class: admission.class,
    status: admission.status,
    createdAt: admission.createdAt,
    updatedAt: admission.updatedAt,
  };
}

function mapCurrentUserAdmission(admission) {
  return {
    id: admission._id.toString(),
    name: admission.name,
    email: admission.email,
    phone: admission.phone,
    class: admission.class,
    message: admission.message,
    status: admission.status,
    createdAt: admission.createdAt,
    updatedAt: admission.updatedAt,
  };
}

function mapAdmissionPublicSubmission(admission) {
  return {
    id: admission._id.toString(),
    status: admission.status,
    createdAt: admission.createdAt,
  };
}

function mapAdmissionNote(note) {
  return {
    id: note._id.toString(),
    admissionId: note.admissionId.toString(),
    note: note.note,
    createdBy: mapNoteAuthor(note.createdBy),
    createdAt: note.createdAt,
  };
}

function mapAdmissionDetail(admission, notes = []) {
  return {
    id: admission._id.toString(),
    name: admission.name,
    phone: admission.phone,
    email: admission.email,
    class: admission.class,
    message: admission.message,
    status: admission.status,
    createdAt: admission.createdAt,
    updatedAt: admission.updatedAt,
    notes: notes.map(mapAdmissionNote),
  };
}

async function findAdmissionByIdOrThrow(admissionId) {
  const admission = await Admission.findById(admissionId).exec();

  if (!admission) {
    throw createHttpError(404, 'Admission not found');
  }

  return admission;
}

async function assertNotRecentDuplicateInquiry({ email, phone, className }) {
  const since = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
  const recentInquiry = await Admission.findOne({
    class: className,
    createdAt: { $gte: since },
    $or: [{ email }, { phone }],
  })
    .select('_id')
    .lean();

  if (recentInquiry) {
    throw createHttpError(
      429,
      'A recent inquiry with the same contact details already exists. Please wait before submitting again.',
    );
  }
}

function shouldLinkAdmissionToUser(user) {
  return user?.role === USER_ROLES.STUDENT || user?.role === USER_ROLES.TEACHER;
}

export async function createAdmission(payload, user = null) {
  const normalizedPayload = {
    name: normalizeSingleLineText(payload.name),
    phone: normalizePhone(payload.phone),
    email: normalizeEmail(payload.email),
    class: normalizeSingleLineText(payload.class),
    message: payload.message ? normalizeMultilineText(payload.message) : null,
    userId: shouldLinkAdmissionToUser(user) ? user.id : null,
  };

  await assertNotRecentDuplicateInquiry({
    email: normalizedPayload.email,
    phone: normalizedPayload.phone,
    className: normalizedPayload.class,
  });

  const admission = await Admission.create(normalizedPayload);

  return mapAdmissionPublicSubmission(admission);
}

export async function listAdmissions(filters = {}) {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  const admissions = await Admission.find(query).sort({ createdAt: -1 }).lean();

  return admissions.map(mapAdmissionListItem);
}

export async function listAdmissionsForUser(user) {
  const admissions = await Admission.find({ userId: user.id }).sort({ createdAt: -1 }).lean();

  return admissions.map(mapCurrentUserAdmission);
}

export async function getAdmissionById(admissionId) {
  const admission = await Admission.findById(admissionId).lean();

  if (!admission) {
    throw createHttpError(404, 'Admission not found');
  }

  const notes = await AdmissionNote.find({ admissionId })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'email')
    .lean();

  return mapAdmissionDetail(admission, notes);
}

export async function updateAdmissionStatus(admissionId, status) {
  const admission = await findAdmissionByIdOrThrow(admissionId);
  admission.status = status;
  await admission.save();

  // Automatically create a Student record when admission is approved.
  // Idempotent — if a student already exists for this admission, it's a no-op.
  if (status === 'approved') {
    try {
      await createStudentFromAdmission(admission);
    } catch (conversionError) {
      // Log but don't fail the status update — the admission is already approved.
      // The student can be created manually or by re-approving if this ever fails.
      console.error('Student auto-creation failed for admission', admissionId, conversionError);
    }
  }

  return {
    id: admission._id.toString(),
    status: admission.status,
    updatedAt: admission.updatedAt,
  };
}

export async function createAdmissionNote(admissionId, note, user) {
  await findAdmissionByIdOrThrow(admissionId);

  const savedNote = await AdmissionNote.create({
    admissionId,
    note: normalizeMultilineText(note),
    createdBy: user.id,
  });

  return {
    id: savedNote._id.toString(),
    admissionId: savedNote.admissionId.toString(),
    note: savedNote.note,
    createdBy: {
      id: user.id,
      email: user.email,
    },
    createdAt: savedNote.createdAt,
  };
}
