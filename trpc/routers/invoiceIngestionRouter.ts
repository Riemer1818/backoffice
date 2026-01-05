import { router, publicProcedure } from '../trpc';
import { InvoiceIngestionApp } from '../../apps/invoice-ingestion/InvoiceIngestionApp';

const invoiceIngestionRouter = router({
  // Manually trigger invoice ingestion
  processInvoices: publicProcedure
    .mutation(async ({ ctx }) => {
      console.log('📧 [Manual] Starting invoice ingestion...');

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
});

export { invoiceIngestionRouter };
