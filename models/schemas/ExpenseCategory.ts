import { z } from 'zod';
import { BaseEntitySchema } from './BaseEntity';

/**
 * Expense category schema
 */
export const ExpenseCategorySchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

export type ExpenseCategoryType = z.infer<typeof ExpenseCategorySchema>;

export const ExpenseCategoryInputSchema = ExpenseCategorySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type ExpenseCategoryInput = z.infer<typeof ExpenseCategoryInputSchema>;

export const ExpenseCategoryUpdateSchema = ExpenseCategoryInputSchema.partial();
export type ExpenseCategoryUpdate = z.infer<typeof ExpenseCategoryUpdateSchema>;
