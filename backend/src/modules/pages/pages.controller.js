import { ZodError } from 'zod';
import { sendError, sendSuccess } from '../../utils/response.js';
import {
  createPageSchema,
  pageIdParamSchema,
  publicPageSlugParamSchema,
  updatePageSchema,
  updatePageStatusSchema,
} from './pages.schema.js';
import {
  createPage,
  deletePage,
  getPublishedPageBySlug,
  listPages,
  updatePage,
  updatePageStatus,
} from './pages.service.js';

function handlePagesError(error, request, reply, fallbackMessage) {
  if (error instanceof ZodError) {
    return sendError(reply, 400, 'Validation failed', error.issues);
  }

  if (error.code === 11000) {
    return sendError(reply, 409, 'A page with this slug already exists');
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode >= 500 ? fallbackMessage : error.message;

  if (statusCode >= 500) {
    request.log.error(error);
  }

  return sendError(reply, statusCode, message);
}

export async function listPagesHandler(request, reply) {
  try {
    const pages = await listPages();

    return sendSuccess(reply, 200, pages, 'Pages fetched successfully');
  } catch (error) {
    return handlePagesError(error, request, reply, 'Failed to fetch pages');
  }
}

export async function createPageHandler(request, reply) {
  try {
    const payload = createPageSchema.parse(request.body);
    const page = await createPage(payload);

    return sendSuccess(reply, 201, page, 'Page created successfully');
  } catch (error) {
    return handlePagesError(error, request, reply, 'Failed to create page');
  }
}

export async function updatePageHandler(request, reply) {
  try {
    const { id } = pageIdParamSchema.parse(request.params);
    const payload = updatePageSchema.parse(request.body);
    const page = await updatePage(id, payload);

    return sendSuccess(reply, 200, page, 'Page updated successfully');
  } catch (error) {
    return handlePagesError(error, request, reply, 'Failed to update page');
  }
}

export async function deletePageHandler(request, reply) {
  try {
    const { id } = pageIdParamSchema.parse(request.params);
    const deletedPage = await deletePage(id);

    return sendSuccess(reply, 200, deletedPage, 'Page deleted successfully');
  } catch (error) {
    return handlePagesError(error, request, reply, 'Failed to delete page');
  }
}

export async function updatePageStatusHandler(request, reply) {
  try {
    const { id } = pageIdParamSchema.parse(request.params);
    const { status } = updatePageStatusSchema.parse(request.body);
    const page = await updatePageStatus(id, status);

    return sendSuccess(reply, 200, page, 'Page status updated successfully');
  } catch (error) {
    return handlePagesError(error, request, reply, 'Failed to update page status');
  }
}

export async function getPublicPageBySlugHandler(request, reply) {
  try {
    const { slug } = publicPageSlugParamSchema.parse(request.params);
    const page = await getPublishedPageBySlug(slug);

    return sendSuccess(reply, 200, page, 'Published page fetched successfully');
  } catch (error) {
    return handlePagesError(error, request, reply, 'Failed to fetch published page');
  }
}
