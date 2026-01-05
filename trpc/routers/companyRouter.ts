import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { Company } from '../../models/Company';

const companyRouter = router({
  // List all companies
  getAll: publicProcedure
    .input(z.object({
      type: z.enum(['client', 'supplier', 'both']).optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const companies = await ctx.repos.company.findAll();

      if (!companies) {
        return [];
      }

      let filtered = companies;

      // Filter by type if provided
      if (input?.type) {
        filtered = filtered.filter(c => c.data.type === input.type);
      }

      // Filter by active status if provided
      if (input?.isActive !== undefined) {
        filtered = filtered.filter(c => c.data.is_active === input.isActive);
      }

      // Return plain data objects for JSON serialization
      return filtered.map(c => c.data);
    }),

  // Get single company by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.repos.company.findById(input.id);
      if (!company) {
        throw new Error('Company not found');
      }
      return company.data;
    }),

  // Create company
  create: publicProcedure
    .input(z.object({
      type: z.enum(['client', 'supplier', 'both']),
      name: z.string().min(1).max(255),
      main_contact_person: z.string().max(255).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(50).optional(),
      street_address: z.string().max(255).optional(),
      postal_code: z.string().max(20).optional(),
      city: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
      btw_number: z.string().max(50).optional(),
      kvk_number: z.string().max(50).optional(),
      iban: z.string().max(34).optional(),
      notes: z.string().optional(),
      is_active: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = new Company({ ...input, id: 0 });
      return await ctx.repos.company.create(company);
    }),

  // Update company
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        type: z.enum(['client', 'supplier', 'both']).optional(),
        name: z.string().min(1).max(255).optional(),
        main_contact_person: z.string().max(255).optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().max(50).optional(),
        street_address: z.string().max(255).optional(),
        postal_code: z.string().max(20).optional(),
        city: z.string().max(100).optional(),
        country: z.string().max(100).optional(),
        btw_number: z.string().max(50).optional(),
        kvk_number: z.string().max(50).optional(),
        iban: z.string().max(34).optional(),
        notes: z.string().optional(),
        is_active: z.boolean().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.repos.company.findById(input.id);
      if (!existing) {
        throw new Error('Company not found');
      }

      const updated = new Company({
        ...existing.data,
        ...input.data,
        id: input.id,
      });

      return await ctx.repos.company.update(updated);
    }),

  // Delete company
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.repos.company.delete(input.id);
      return { success: true };
    }),
});

export { companyRouter };
