import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const invoiceRouter = router({
  // Get all invoices
  getAll: publicProcedure
    .input(z.object({
      status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
      clientId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM invoices WHERE 1=1';
      const params: any[] = [];

      if (input?.status) {
        params.push(input.status);
        query += ` AND status = $${params.length}`;
      }

      if (input?.clientId) {
        params.push(input.clientId);
        query += ` AND client_id = $${params.length}`;
      }

      query += ' ORDER BY invoice_date DESC';

      const result = await ctx.db.query(query, params);
      return result.rows;
    }),

  // Get single invoice
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        'SELECT * FROM invoices WHERE id = $1',
        [input.id]
      );

      if (result.rows.length === 0) {
        throw new Error('Invoice not found');
      }

      return result.rows[0];
    }),

  // Update invoice status
  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
      paidDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        `UPDATE invoices
         SET status = $1, paid_date = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [input.status, input.paidDate || null, input.id]
      );

      return result.rows[0];
    }),

  // Delete invoice
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.query('DELETE FROM invoices WHERE id = $1', [input.id]);
      return { success: true };
    }),
});

export { invoiceRouter };
