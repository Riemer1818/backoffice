import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Project schema
 */
export const ProjectStatusSchema = z.enum(['active', 'on_hold', 'completed', 'cancelled', 'archived']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectSchema = BaseEntitySchema.extend({
  client_id: z.number().int().positive(),

  name: z.string().min(1).max(255),
  description: z.string().optional(),

  // Pricing
  hourly_rate: z.number().min(0).optional(),
  currency: z.string().length(3).default('EUR'),
  tax_rate_id: z.number().int().positive().optional(),

  // Status
  status: ProjectStatusSchema.default('active'),

  // Timeline
  start_date: z.date().optional(),
  end_date: z.date().optional(),

  // Appearance
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1e3a8a'),
});

export type ProjectType = z.infer<typeof ProjectSchema>;

export const ProjectInputSchema = ProjectSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;

export const ProjectUpdateSchema = ProjectInputSchema.partial();
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
