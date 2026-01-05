import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ContactAssociation } from '../../models/ContactAssociation';

const contactAssociationRouter = router({
  // Get associations for a contact
  getByContactId: publicProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await ctx.repos.contactAssociation.findWithDetails(input.contactId);
    }),

  // Get associations for a company
  getByCompanyId: publicProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await ctx.repos.contactAssociation.findWithDetails(undefined, input.companyId);
    }),

  // Get associations for a project
  getByProjectId: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await ctx.repos.contactAssociation.findWithDetails(undefined, undefined, input.projectId);
    }),

  // Create association
  create: publicProcedure
    .input(z.object({
      contact_id: z.number().int().positive(),
      company_id: z.number().int().positive().optional(),
      project_id: z.number().int().positive().optional(),
      role: z.string().max(100).optional(),
      is_primary: z.boolean().default(false),
      is_active: z.boolean().default(true),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const association = new ContactAssociation({ ...input, id: 0 });
      const created = await ctx.repos.contactAssociation.create(association);

      // If setting as primary for a company, update accordingly
      if (input.is_primary && input.company_id) {
        await ctx.repos.contactAssociation.setPrimaryForCompany(input.contact_id, input.company_id);
      }

      return created;
    }),

  // Update association
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        role: z.string().max(100).optional(),
        is_primary: z.boolean().optional(),
        is_active: z.boolean().optional(),
        notes: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.repos.contactAssociation.findById(input.id);
      if (!existing) {
        throw new Error('Association not found');
      }

      const updated = new ContactAssociation({
        ...existing.data,
        ...input.data,
        id: input.id,
      });

      const result = await ctx.repos.contactAssociation.update(updated);

      // If setting as primary, update accordingly
      if (input.data.is_primary && existing.data.company_id) {
        await ctx.repos.contactAssociation.setPrimaryForCompany(
          existing.data.contact_id,
          existing.data.company_id
        );
      }

      return result;
    }),

  // Delete association
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.repos.contactAssociation.delete(input.id);
      return { success: true };
    }),

  // Set as primary contact for company
  setPrimary: publicProcedure
    .input(z.object({
      contactId: z.number(),
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.repos.contactAssociation.setPrimaryForCompany(input.contactId, input.companyId);
      return { success: true };
    }),
});

export { contactAssociationRouter };
