import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Contact Association schema - links contacts to companies/projects with roles
 */
export const ContactAssociationSchema = BaseEntitySchema.extend({
  contact_id: z.number().int().positive(),
  company_id: z.number().int().positive().optional(),
  project_id: z.number().int().positive().optional(),
  role: z.string().max(100).optional(),
  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),
  notes: z.string().optional(),
});

export type ContactAssociationType = z.infer<typeof ContactAssociationSchema>;

export const ContactAssociationInputSchema = ContactAssociationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type ContactAssociationInput = z.infer<typeof ContactAssociationInputSchema>;

export const ContactAssociationUpdateSchema = ContactAssociationInputSchema.partial();
export type ContactAssociationUpdate = z.infer<typeof ContactAssociationUpdateSchema>;
