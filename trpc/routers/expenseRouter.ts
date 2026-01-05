import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const expenseRouter = router({
  // Get all expenses (incoming invoices)
  getAll: publicProcedure
    .input(z.object({
      reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
      supplierId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM incoming_invoices WHERE 1=1';
      const params: any[] = [];

      if (input?.reviewStatus) {
        params.push(input.reviewStatus);
        query += ` AND review_status = $${params.length}`;
      }

      if (input?.supplierId) {
        params.push(input.supplierId);
        query += ` AND supplier_id = $${params.length}`;
      }

      query += ' ORDER BY invoice_date DESC';

      const result = await ctx.db.query(query, params);
      return result.rows;
    }),

  // Get single expense
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        'SELECT * FROM incoming_invoices WHERE id = $1',
        [input.id]
      );

      if (result.rows.length === 0) {
        throw new Error('Expense not found');
      }

      const expense = result.rows[0];

      // Convert PDF bytea to base64 if it exists
      if (expense.invoice_file) {
        expense.invoice_file_base64 = expense.invoice_file.toString('base64');
        delete expense.invoice_file; // Remove binary data
      }

      return expense;
    }),

  // Get pending for review
  getPending: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(
        `SELECT * FROM incoming_invoices
         WHERE review_status = 'pending'
         ORDER BY invoice_date DESC`
      );

      return result.rows;
    }),

  // Approve expense
  approve: publicProcedure
    .input(z.object({
      id: z.number(),
      edits: z.object({
        supplier_name: z.string().optional(),
        description: z.string().optional(),
        subtotal: z.number().optional(),
        tax_amount: z.number().optional(),
        total_amount: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Apply edits if provided
      if (input.edits) {
        const setClauses: string[] = [];
        const params: any[] = [];

        Object.entries(input.edits).forEach(([key, value]) => {
          if (value !== undefined) {
            params.push(value);
            setClauses.push(`${key} = $${params.length}`);
          }
        });

        if (setClauses.length > 0) {
          params.push(input.id);
          await ctx.db.query(
            `UPDATE incoming_invoices SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
            params
          );
        }
      }

      // Approve
      const result = await ctx.db.query(
        `UPDATE incoming_invoices
         SET review_status = 'approved', reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.id]
      );

      return result.rows[0];
    }),

  // Reject expense
  reject: publicProcedure
    .input(z.object({
      id: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        `UPDATE incoming_invoices
         SET review_status = 'rejected', reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.id]
      );

      return result.rows[0];
    }),

  // Delete expense
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.query('DELETE FROM incoming_invoices WHERE id = $1', [input.id]);
      return { success: true };
    }),

  // Upload PDF
  uploadPdf: publicProcedure
    .input(z.object({
      id: z.number(),
      pdfBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');

      const result = await ctx.db.query(
        `UPDATE incoming_invoices
         SET invoice_file = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [pdfBuffer, input.id]
      );

      return result.rows[0];
    }),
});

export { expenseRouter };
