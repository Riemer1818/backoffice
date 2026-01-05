import { z } from 'zod';

/**
 * Base schema for all entities with timestamps
 */
export const BaseEntitySchema = z.object({
  id: z.number().int().positive().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export type BaseEntityType = z.infer<typeof BaseEntitySchema>;
