import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Invoice schema (outgoing invoices to clients)
 */
export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const InvoiceSchema = BaseEntitySchema.extend({
  // References
  client_id: z.number().int().positive(),
  project_id: z.number().int().positive().optional(),

  // Invoice details
  invoice_number: z.string().min(1).max(50),
  invoice_date: z.date(),
  due_date: z.date(),

  // Status
  status: InvoiceStatusSchema.default('draft'),

  // Amounts
  subtotal: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0).default(0),
  currency: z.string().length(3).default('EUR'),

  // Payment
  payment_terms_days: z.number().int().positive().default(14),
  paid_date: z.date().optional(),

  // Files
  pdf_file: z.instanceof(Buffer).optional(),

  notes: z.string().optional(),
});

export type InvoiceType = z.infer<typeof InvoiceSchema>;

export const InvoiceInputSchema = InvoiceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InvoiceInput = z.infer<typeof InvoiceInputSchema>;

export const InvoiceUpdateSchema = InvoiceInputSchema.partial();
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;
