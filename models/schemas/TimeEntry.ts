import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Time entry schema
 */
export const TimeEntrySchema = BaseEntitySchema.extend({
  project_id: z.number().int().positive(),
  contact_id: z.number().int().positive().optional(),

  // Date & time
  date: z.date(),
  start_time: z.date().optional(), // TIMESTAMPTZ
  end_time: z.date().optional(),   // TIMESTAMPTZ

  // Hours
  total_hours: z.number().min(0).max(24),
  chargeable_hours: z.number().min(0).max(24),

  // Details
  location: z.string().max(255).optional(),
  objective: z.string().optional(),
  notes: z.string().optional(),

  // Invoicing
  is_invoiced: z.boolean().default(false),
  invoice_id: z.number().int().positive().optional(),
});

export type TimeEntryType = z.infer<typeof TimeEntrySchema>;

export const TimeEntryInputSchema = TimeEntrySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  invoice_id: true, // Set by system when invoiced
});

export type TimeEntryInput = z.infer<typeof TimeEntryInputSchema>;

export const TimeEntryUpdateSchema = TimeEntryInputSchema.partial();
export type TimeEntryUpdate = z.infer<typeof TimeEntryUpdateSchema>;
