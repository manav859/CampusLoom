import { z } from 'zod';

export const getStudyMaterialQuerySchema = z.object({
  class: z.string().optional(),
});
