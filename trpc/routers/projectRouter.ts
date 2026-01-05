import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { Project } from '../../models/Project';

const projectRouter = router({
  // List all projects
  getAll: publicProcedure
    .input(z.object({
      status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
      clientId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Use SQL query to get projects with client names
      let query = `
        SELECT
          p.*,
          c.name as client_name
        FROM projects p
        LEFT JOIN companies c ON p.client_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (input?.status) {
        params.push(input.status);
        query += ` AND p.status = $${params.length}`;
      }

      if (input?.clientId) {
        params.push(input.clientId);
        query += ` AND p.client_id = $${params.length}`;
      }

      query += ' ORDER BY p.id DESC';

      const result = await ctx.db.query(query, params);
      return result.rows;
    }),

  // Get single project by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query(`
        SELECT
          p.*,
          c.name as client_name
        FROM projects p
        LEFT JOIN companies c ON p.client_id = c.id
        WHERE p.id = $1
      `, [input.id]);

      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }

      return result.rows[0];
    }),

  // Create project
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      client_id: z.number(),
      description: z.string().optional(),
      hourly_rate: z.number().default(0),
      tax_rate_id: z.number(),
      status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).default('active'),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      currency: z.string().default('EUR'),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1e3a8a'),
    }))
    .mutation(async ({ ctx, input }) => {
      const project = new Project({ ...input, id: 0 });
      return await ctx.repos.project.create(project);
    }),

  // Update project
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        name: z.string().min(1).max(255).optional(),
        client_id: z.number().optional(),
        description: z.string().optional(),
        hourly_rate: z.number().optional(),
        tax_rate_id: z.number().optional(),
        status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        currency: z.string().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.repos.project.findById(input.id);
      if (!existing) {
        throw new Error('Project not found');
      }

      const updated = new Project({
        ...existing.data,
        ...input.data,
        start_date: input.data.start_date ? new Date(input.data.start_date) : existing.data.start_date,
        end_date: input.data.end_date ? new Date(input.data.end_date) : existing.data.end_date,
        id: input.id,
      });

      return await ctx.repos.project.update(input.id, updated);
    }),

  // Delete project
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.repos.project.delete(input.id);
      return { success: true };
    }),
});

export { projectRouter };
