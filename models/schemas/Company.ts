import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Company schema (clients, suppliers, or both)
 */
export const CompanySchema = BaseEntitySchema.extend({
  type: z.enum(['client', 'supplier', 'both']),

  // Basic info
  name: z.string().min(1).max(255),
  kvk_number: z.string().max(50).optional(),
  btw_number: z.string().max(50).optional(),

  // Main contact
  main_contact_person: z.string().max(255).optional(),

  // Contact info
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  website: z.string().url().optional().or(z.literal('')),

  // Address
  street_address: z.string().max(255).optional(),
  postal_code: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).default('Netherlands'),

  // Banking
  iban: z.string().max(50).optional(),

  // Metadata
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type CompanyType = z.infer<typeof CompanySchema>;

export const CompanyInputSchema = CompanySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type CompanyInput = z.infer<typeof CompanyInputSchema>;

export const CompanyUpdateSchema = CompanyInputSchema.partial();
export type CompanyUpdate = z.infer<typeof CompanyUpdateSchema>;
