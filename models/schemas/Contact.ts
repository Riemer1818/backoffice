import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Contact schema (people, optionally within companies)
 */
export const ContactSchema = BaseEntitySchema.extend({
  company_id: z.number().int().positive().optional(),

  first_name: z.string().min(1).max(100),
  last_name: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  description: z.string().max(500).optional(),

  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),

  is_primary: z.boolean().default(false),
  is_active: z.boolean().default(true),

  notes: z.string().optional(),
});

export type ContactType = z.infer<typeof ContactSchema>;

export const ContactInputSchema = ContactSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type ContactInput = z.infer<typeof ContactInputSchema>;

export const ContactUpdateSchema = ContactInputSchema.partial();
export type ContactUpdate = z.infer<typeof ContactUpdateSchema>;
