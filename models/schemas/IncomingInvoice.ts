import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Incoming invoice schema (from suppliers)
 * Flow: Email → LLM extraction → Review → Approved/Rejected
 */
export const ReviewStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const PaymentStatusSchema = z.enum(['unpaid', 'paid']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const IncomingInvoiceSchema = BaseEntitySchema.extend({
  // References (can be NULL until reviewed)
  supplier_id: z.number().int().positive().optional(),
  project_id: z.number().int().positive().optional(),

  // Invoice details (extracted by LLM, editable during review)
  invoice_number: z.string().max(100).optional(),
  invoice_date: z.date().optional(),
  due_date: z.date().optional(),

  // Review workflow
  review_status: ReviewStatusSchema.default('pending'),
  reviewed_at: z.date().optional(),
  rejection_reason: z.string().optional(),

  // Payment
  payment_status: PaymentStatusSchema.default('unpaid'),
  paid_date: z.date().optional(),

  // Amounts (extracted by LLM, editable)
  subtotal: z.number().min(0).default(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0).default(0),
  currency: z.string().length(3).default('EUR'),
  tax_rate_id: z.number().int().positive().optional(),

  // Category
  category_id: z.number().int().positive().optional(),

  // Extracted fields
  supplier_name: z.string().max(255).optional(), // Before matching to company
  description: z.string().optional(),
  notes: z.string().optional(),

  // Files
  invoice_file: z.instanceof(Buffer).optional(),
  invoice_file_name: z.string().max(255).optional(),
  invoice_file_type: z.string().max(50).optional(),

  // Source tracking
  source: z.string().max(50).default('manual'),
  source_email_id: z.string().max(255).optional(),
  source_email_subject: z.string().max(500).optional(),
  source_email_from: z.string().max(255).optional(),
  source_email_date: z.date().optional(),

  // LLM metadata
  extraction_errors: z.string().optional(),
});

export type IncomingInvoiceType = z.infer<typeof IncomingInvoiceSchema>;

export const IncomingInvoiceInputSchema = IncomingInvoiceSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type IncomingInvoiceInput = z.infer<typeof IncomingInvoiceInputSchema>;

export const IncomingInvoiceUpdateSchema = IncomingInvoiceInputSchema.partial();
export type IncomingInvoiceUpdate = z.infer<typeof IncomingInvoiceUpdateSchema>;
