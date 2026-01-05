import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { Contact } from '../../models/Contact';

const contactRouter = router({
  // List all contacts (with optional company filter)
  getAll: publicProcedure
    .input(z.object({
      companyId: z.number().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let contacts;

      if (input?.companyId) {
        contacts = await ctx.repos.contact.findByCompanyId(input.companyId);
      } else {
        contacts = await ctx.repos.contact.findAll();
      }

      if (!contacts) {
        return [];
      }

      let filtered = contacts;

      // Filter by active status if provided
      if (input?.isActive !== undefined) {
        filtered = filtered.filter(c => c.data.is_active === input.isActive);
      }

      return filtered.map(c => c.data);
    }),

  // Get all contacts with company info
  getAllWithCompany: publicProcedure
    .input(z.object({
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const contacts = await ctx.repos.contact.findAllWithCompany();

      if (!contacts) {
        return [];
      }

      let filtered = contacts;

      // Filter by active status if provided
      if (input?.isActive !== undefined) {
        filtered = filtered.filter(c => c.is_active === input.isActive);
      }

      return filtered;
    }),

  // Get single contact by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const contact = await ctx.repos.contact.findById(input.id);
      if (!contact) {
        throw new Error('Contact not found');
      }
      return contact.data;
    }),

  // Get contacts by company ID
  getByCompanyId: publicProcedure
    .input(z.object({
      companyId: z.number(),
      activeOnly: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const contacts = input.activeOnly
        ? await ctx.repos.contact.findActiveByCompanyId(input.companyId)
        : await ctx.repos.contact.findByCompanyId(input.companyId);

      return contacts.map(c => c.data);
    }),

  // Get primary contact for a company
  getPrimaryByCompanyId: publicProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const contact = await ctx.repos.contact.findPrimaryContactByCompanyId(input.companyId);
      return contact ? contact.data : null;
    }),

  // Create contact
  create: publicProcedure
    .input(z.object({
      company_id: z.number().int().positive(),
      first_name: z.string().min(1).max(100),
      last_name: z.string().min(1).max(100),
      role: z.string().max(100).optional(),
      email: z.string().email().optional().or(z.literal('')),
      phone: z.string().max(50).optional(),
      is_primary: z.boolean().default(false),
      is_active: z.boolean().default(true),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const contact = new Contact({ ...input, id: 0 });
      const created = await ctx.repos.contact.create(contact);

      // If this is set as primary, update the company
      if (input.is_primary) {
        await ctx.repos.contact.setPrimary(created.id);
      }

      return created;
    }),

  // Update contact
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        company_id: z.number().int().positive().optional(),
        first_name: z.string().min(1).max(100).optional(),
        last_name: z.string().min(1).max(100).optional(),
        role: z.string().max(100).optional(),
        email: z.string().email().optional().or(z.literal('')),
        phone: z.string().max(50).optional(),
        is_primary: z.boolean().optional(),
        is_active: z.boolean().optional(),
        notes: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.repos.contact.findById(input.id);
      if (!existing) {
        throw new Error('Contact not found');
      }

      const updated = new Contact({
        ...existing.data,
        ...input.data,
        id: input.id,
      });

      const result = await ctx.repos.contact.update(updated);

      // If setting as primary, update accordingly
      if (input.data.is_primary) {
        await ctx.repos.contact.setPrimary(input.id);
      }

      return result;
    }),

  // Set contact as primary
  setPrimary: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const success = await ctx.repos.contact.setPrimary(input.id);
      if (!success) {
        throw new Error('Contact not found');
      }
      return { success: true };
    }),

  // Delete contact
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.repos.contact.delete(input.id);
      return { success: true };
    }),

  // Search contacts
  search: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const contacts = await ctx.repos.contact.searchByName(input.query);
      return contacts.map(c => c.data);
    }),
});

export { contactRouter };