import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Tax rate schema (BTW/VAT rates)
 */
export const TaxRateSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(50),
  rate: z.number().min(0).max(100), // Percentage
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type TaxRateType = z.infer<typeof TaxRateSchema>;

// For creating/updating (without auto-generated fields)
export const TaxRateInputSchema = TaxRateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type TaxRateInput = z.infer<typeof TaxRateInputSchema>;

export const TaxRateUpdateSchema = TaxRateInputSchema.partial();
export type TaxRateUpdate = z.infer<typeof TaxRateUpdateSchema>;
