import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Invoice item schema (line items in invoices)
 */
export const InvoiceItemSchema = BaseEntitySchema.extend({
  invoice_id: z.number().int().positive(),

  description: z.string().min(1),
  quantity: z.number().min(0).default(1),
  unit_price: z.number().min(0),

  tax_rate_id: z.number().int().positive().optional(),

  // Calculated fields
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0),
  line_total: z.number().min(0),
});

export type InvoiceItemType = z.infer<typeof InvoiceItemSchema>;

export const InvoiceItemInputSchema = InvoiceItemSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InvoiceItemInput = z.infer<typeof InvoiceItemInputSchema>;

export const InvoiceItemUpdateSchema = InvoiceItemInputSchema.partial();
export type InvoiceItemUpdate = z.infer<typeof InvoiceItemUpdateSchema>;
