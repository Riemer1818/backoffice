import { router, publicProcedure } from '../trpc';
import { InvoiceIngestionApp } from '../../apps/invoice-ingestion/InvoiceIngestionApp';

const invoiceIngestionRouter = router({
  // Automatically check email for new invoices
  processInvoices: publicProcedure.mutation(async ({ ctx }) => {
    console.log('📧 [Manual] Starting invoice ingestion from email...');

    try {
      const ingestionApp = new InvoiceIngestionApp(ctx.db);
      await ingestionApp.processInvoices();

      console.log('✅ [Manual] Invoice ingestion completed');

      return {
        success: true,
        message: 'Invoice ingestion completed successfully',
      };
    } catch (error) {
      console.error('❌ [Manual] Invoice ingestion failed:', error);

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }),

  // Get pending invoices (expenses without categories/projects)
  getPendingInvoices: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query(
      `SELECT id, date, supplier_name, description, amount, vat_amount,
              receipt_filename, created_at
       FROM expenses
       WHERE (category_id IS NULL OR project_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return result.rows;
  }),
});

export { invoiceIngestionRouter };
