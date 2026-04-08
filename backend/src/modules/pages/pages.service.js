import { Page } from './page.model.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

export function sanitizeSlug(input) {
  if (typeof input !== 'string') {
    return '';
  }

  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return normalized
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function buildUniqueSlug(source, excludeId) {
  const baseSlug = sanitizeSlug(source) || 'page';
  let candidate = baseSlug;
  let suffix = 1;

  for (;;) {
    const existingPage = await Page.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (!existingPage) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function mapAdminPage(page) {
  return {
    id: page._id.toString(),
    title: page.title,
    slug: page.slug,
    content: page.content,
    status: page.status,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

function mapPublicPage(page) {
  return {
    title: page.title,
    content: page.content,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
  };
}

async function findPageByIdOrThrow(pageId) {
  const page = await Page.findById(pageId);

  if (!page) {
    throw createHttpError(404, 'Page not found');
  }

  return page;
}

export async function listPages() {
  const pages = await Page.find()
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return pages.map(mapAdminPage);
}

export async function createPage(payload) {
  const page = await Page.create({
    title: payload.title.trim(),
    slug: await buildUniqueSlug(payload.slug ?? payload.title),
    content: payload.content,
    status: payload.status,
    seoTitle: payload.seoTitle?.trim() ?? '',
    seoDescription: payload.seoDescription?.trim() ?? '',
  });

  return mapAdminPage(page);
}

export async function updatePage(pageId, payload) {
  const page = await findPageByIdOrThrow(pageId);

  if (payload.title !== undefined) {
    page.title = payload.title.trim();
  }

  if (payload.slug !== undefined) {
    page.slug = await buildUniqueSlug(payload.slug, pageId);
  }

  if (payload.content !== undefined) {
    page.content = payload.content;
  }

  if (payload.status !== undefined) {
    page.status = payload.status;
  }

  if (payload.seoTitle !== undefined) {
    page.seoTitle = payload.seoTitle.trim();
  }

  if (payload.seoDescription !== undefined) {
    page.seoDescription = payload.seoDescription.trim();
  }

  await page.save();

  return mapAdminPage(page);
}

export async function deletePage(pageId) {
  const page = await findPageByIdOrThrow(pageId);

  await page.deleteOne();

  return {
    id: page._id.toString(),
  };
}

export async function updatePageStatus(pageId, status) {
  const page = await findPageByIdOrThrow(pageId);
  page.status = status;

  await page.save();

  return mapAdminPage(page);
}

export async function getPublishedPageBySlug(slug) {
  const sanitizedSlug = sanitizeSlug(slug);

  if (!sanitizedSlug) {
    throw createHttpError(400, 'Invalid page slug');
  }

  const page = await Page.findOne({
    slug: sanitizedSlug,
    status: 'published',
  })
    .select('title content seoTitle seoDescription')
    .lean();

  if (!page) {
    throw createHttpError(404, 'Published page not found');
  }

  return mapPublicPage(page);
}
