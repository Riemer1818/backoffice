import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { InvoicePdfGenerator } from '../../core/pdf/InvoicePdfGenerator';

const invoiceRouter = router({
  // Get all invoices
  getAll: publicProcedure
    .input(z.object({
      status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
      clientId: z.number().optional(),
      projectId: z.number().optional(),
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

      if (input?.projectId) {
        params.push(input.projectId);
        query += ` AND project_id = $${params.length}`;
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
        `SELECT
          i.*,
          c.name as client_name,
          c.email as client_email,
          c.phone as client_phone,
          p.name as project_name,
          p.description as project_description
         FROM invoices i
         LEFT JOIN companies c ON i.client_id = c.id
         LEFT JOIN projects p ON i.project_id = p.id
         WHERE i.id = $1`,
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

  // Create invoice from project
  createFromProject: publicProcedure
    .input(z.object({
      projectId: z.number(),
      includeTimeEntryIds: z.array(z.number()).optional(),
      taxRate: z.number().default(21),
      paymentTermsDays: z.number().default(14),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.connect();

      try {
        await client.query('BEGIN');

        // Get project details
        const projectResult = await client.query(
          `SELECT p.*, c.name as client_name, c.email as client_email, c.phone as client_phone
           FROM projects p
           LEFT JOIN companies c ON p.client_id = c.id
           WHERE p.id = $1`,
          [input.projectId]
        );

        if (projectResult.rows.length === 0) {
          throw new Error('Project not found');
        }

        const project = projectResult.rows[0];

        // Get unbilled time entries for this project
        let timeEntriesQuery = `
          SELECT te.*,
                 CONCAT(c.first_name, ' ', c.last_name) as contact_name
          FROM time_entries te
          LEFT JOIN contacts c ON te.contact_id = c.id
          WHERE te.project_id = $1 AND te.is_invoiced = false AND te.invoice_id IS NULL
        `;
        const params: any[] = [input.projectId];

        // If specific time entry IDs are provided, filter by them
        if (input.includeTimeEntryIds && input.includeTimeEntryIds.length > 0) {
          params.push(input.includeTimeEntryIds);
          timeEntriesQuery += ` AND te.id = ANY($${params.length})`;
        }

        timeEntriesQuery += ' ORDER BY te.date ASC';

        const timeEntriesResult = await client.query(timeEntriesQuery, params);

        if (timeEntriesResult.rows.length === 0) {
          throw new Error('No unbilled time entries found for this project');
        }

        const timeEntries = timeEntriesResult.rows;

        // Calculate totals
        const totalHours = timeEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.chargeable_hours), 0);
        const hourlyRate = parseFloat(project.hourly_rate) || 0;
        const subtotal = totalHours * hourlyRate;
        const taxAmount = subtotal * (input.taxRate / 100);
        const totalAmount = subtotal + taxAmount;

        // Generate invoice number
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const countResult = await client.query(
          `SELECT COUNT(*) as count FROM invoices WHERE invoice_number LIKE $1`,
          [`INV-${today}-%`]
        );
        const dailyCount = parseInt(countResult.rows[0].count) + 1;
        const invoiceNumber = `INV-${today}-${dailyCount}`;

        // Create invoice
        const invoiceResult = await client.query(
          `INSERT INTO invoices (
            client_id, project_id, invoice_number, invoice_date, due_date,
            status, subtotal, tax_amount, total_amount, currency, payment_terms_days, notes
          ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4 || ' days')::interval, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *`,
          [
            project.client_id,
            input.projectId,
            invoiceNumber,
            input.paymentTermsDays,
            'draft',
            subtotal,
            taxAmount,
            totalAmount,
            'EUR',
            input.paymentTermsDays,
            input.notes || `Invoice for ${project.name} - ${totalHours}h @ €${hourlyRate}/h`
          ]
        );

        const invoice = invoiceResult.rows[0];

        // Link time entries to invoice (trigger will mark them as invoiced)
        for (const entry of timeEntries) {
          await client.query(
            `INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
             VALUES ($1, $2)`,
            [invoice.id, entry.id]
          );
        }

        await client.query('COMMIT');

        return invoice;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }),

  // Generate PDF for invoice
  generatePdf: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const generator = new InvoicePdfGenerator();
      const pdfBuffer = await generator.generatePdf(input.id, ctx.db);

      // Update invoice with PDF
      await ctx.db.query(
        'UPDATE invoices SET pdf_file = $1, updated_at = NOW() WHERE id = $2',
        [pdfBuffer, input.id]
      );

      return { success: true, size: pdfBuffer.length };
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
