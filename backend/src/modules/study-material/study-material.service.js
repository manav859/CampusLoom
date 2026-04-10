import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { StudyMaterial } from './study-material.model.js';

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function uploadStudyMaterial(request, user) {
  const parts = request.parts();
  let title = '';
  let description = '';
  let className = '';
  let fileUrl = '';

  for await (const part of parts) {
    if (part.type === 'file') {
      // It's a file
      if (!part.filename) continue;
      
      const fileName = `${Date.now()}-${part.filename.replace(/\s+/g, '_')}`;
      const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'materials', fileName);
      
      await pipeline(part.file, fs.createWriteStream(uploadPath));
      
      // Assume API serves static files from /uploads/materials
      // Or we can save it as an absolute URL, but relative is better
      fileUrl = `/uploads/materials/${fileName}`;
    } else {
      // It's a field
      if (part.fieldname === 'title') title = part.value;
      if (part.fieldname === 'description') description = part.value;
      if (part.fieldname === 'class') className = part.value;
    }
  }

  if (!title || !className || !fileUrl) {
    throw createHttpError(400, 'Title, class, and file are required');
  }

  const material = await StudyMaterial.create({
    title,
    description,
    fileUrl,
    class: className,
    uploadedBy: user.id,
  });

  return {
    id: material._id.toString(),
    title: material.title,
    description: material.description,
    fileUrl: material.fileUrl,
    class: material.class,
    uploadedBy: material.uploadedBy.toString(),
    createdAt: material.createdAt,
  };
}

export async function listStudyMaterials(filters = {}) {
  const query = {};
  if (filters.class) {
    query.class = filters.class;
  }

  const materials = await StudyMaterial.find(query)
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name')
    .lean();

  return materials.map(m => ({
    id: m._id.toString(),
    title: m.title,
    description: m.description,
    fileUrl: m.fileUrl,
    class: m.class,
    uploadedBy: m.uploadedBy ? { id: m.uploadedBy._id.toString(), name: m.uploadedBy.name } : null,
    createdAt: m.createdAt,
  }));
}

export async function deleteStudyMaterial(materialId, user) {
  const material = await StudyMaterial.findById(materialId);
  if (!material) {
    throw createHttpError(404, 'Material not found');
  }

  // Allow admin or the teacher who uploaded it
  if (user.role !== 'admin' && material.uploadedBy.toString() !== user.id) {
    throw createHttpError(403, 'Not authorized to delete this material');
  }

  await StudyMaterial.findByIdAndDelete(materialId);
  
  // Optionally, delete the physical file
  try {
    if (material.fileUrl) {
      const fileName = material.fileUrl.split('/').pop();
      const uploadPath = path.join(process.cwd(), 'public', 'uploads', 'materials', fileName);
      if (fs.existsSync(uploadPath)) {
        fs.unlinkSync(uploadPath);
      }
    }
  } catch (err) {
    console.error('Failed to delete physical file:', err);
  }

  return { id: materialId };
}
