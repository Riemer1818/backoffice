import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { TimeEntry } from '../../models/TimeEntry';

const timeEntriesRouter = router({
  // List all time entries with optional filters
  getAll: publicProcedure
    .input(z.object({
      projectId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isInvoiced: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // If date range is provided, get entries with project info
      if (input?.startDate && input?.endDate) {
        const startDate = new Date(input.startDate);
        const endDate = new Date(input.endDate);
        return await ctx.repos.timeEntry.findAllWithProjectInfo(startDate, endDate);
      }

      // Otherwise get all entries and filter
      const entries = await ctx.repos.timeEntry.findAll();

      if (!entries) {
        return [];
      }

      let filtered = entries;

      // Filter by project if provided
      if (input?.projectId) {
        filtered = filtered.filter(e => e.data.project_id === input.projectId);
      }

      // Filter by invoiced status if provided
      if (input?.isInvoiced !== undefined) {
        filtered = filtered.filter(e => e.data.is_invoiced === input.isInvoiced);
      }

      // Return plain data objects for JSON serialization
      return filtered.map(e => e.data);
    }),

  // Get single time entry by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const entry = await ctx.repos.timeEntry.findById(input.id);
      if (!entry) {
        throw new Error('Time entry not found');
      }
      return entry.data;
    }),

  // Get time entry with project info
  getWithProjectInfo: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const entry = await ctx.repos.timeEntry.findWithProject(input.id);
      if (!entry) {
        throw new Error('Time entry not found');
      }
      return entry;
    }),

  // Get time entries by date range
  getByDateRange: publicProcedure
    .input(z.object({
      startDate: z.string(),
      endDate: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);
      return await ctx.repos.timeEntry.findAllWithProjectInfo(startDate, endDate);
    }),

  // Get uninvoiced time entries
  getUninvoiced: publicProcedure
    .input(z.object({
      projectId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (input?.projectId) {
        const entries = await ctx.repos.timeEntry.findUninvoicedByProject(input.projectId);
        return entries.map(e => e.data);
      }
      const entries = await ctx.repos.timeEntry.findUninvoiced();
      return entries.map(e => e.data);
    }),

  // Get total hours by project
  getTotalHoursByProject: publicProcedure
    .input(z.object({
      projectId: z.number(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = input.startDate ? new Date(input.startDate) : undefined;
      const endDate = input.endDate ? new Date(input.endDate) : undefined;
      return await ctx.repos.timeEntry.getTotalHoursByProject(input.projectId, startDate, endDate);
    }),

  // Create time entry
  create: publicProcedure
    .input(z.object({
      project_id: z.number(),
      contact_id: z.number().optional(),
      date: z.string(),
      start_time: z.string().optional(),
      end_time: z.string().optional(),
      total_hours: z.number().min(0).max(24),
      chargeable_hours: z.number().min(0).max(24),
      location: z.string().optional(),
      objective: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entry = new TimeEntry({
        ...input,
        date: new Date(input.date),
        start_time: input.start_time ? new Date(input.start_time) : undefined,
        end_time: input.end_time ? new Date(input.end_time) : undefined,
        is_invoiced: false,
      });
      return await ctx.repos.timeEntry.create(entry);
    }),

  // Update time entry
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        project_id: z.number().optional(),
        contact_id: z.number().optional(),
        date: z.string().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        total_hours: z.number().min(0).max(24).optional(),
        chargeable_hours: z.number().min(0).max(24).optional(),
        location: z.string().optional(),
        objective: z.string().optional(),
        notes: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.repos.timeEntry.findById(input.id);
      if (!existing) {
        throw new Error('Time entry not found');
      }

      // Don't allow updating invoiced entries
      if (existing.data.is_invoiced) {
        throw new Error('Cannot update invoiced time entry');
      }

      const updated = new TimeEntry({
        ...existing.data,
        ...input.data,
        date: input.data.date ? new Date(input.data.date) : existing.data.date,
        start_time: input.data.start_time ? new Date(input.data.start_time) : existing.data.start_time,
        end_time: input.data.end_time ? new Date(input.data.end_time) : existing.data.end_time,
        id: input.id,
      });

      return await ctx.repos.timeEntry.update(input.id, updated);
    }),

  // Delete time entry
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.repos.timeEntry.findById(input.id);
      if (!existing) {
        throw new Error('Time entry not found');
      }

      // Don't allow deleting invoiced entries
      if (existing.data.is_invoiced) {
        throw new Error('Cannot delete invoiced time entry');
      }

      await ctx.repos.timeEntry.delete(input.id);
      return { success: true };
    }),

  // Mark time entries as invoiced
  markAsInvoiced: publicProcedure
    .input(z.object({
      timeEntryIds: z.array(z.number()),
      invoiceId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.repos.timeEntry.markAsInvoiced(input.timeEntryIds, input.invoiceId);
      return { success: true };
    }),
});

export { timeEntriesRouter };
