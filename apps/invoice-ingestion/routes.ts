import { Router } from 'express';
import { Pool } from 'pg';
import { InvoiceIngestionApp } from './InvoiceIngestionApp';

export function createInvoiceIngestionRoutes(dbPool: Pool): Router {
  const router = Router();
  const app = new InvoiceIngestionApp(dbPool);

  /**
   * Manually trigger invoice ingestion
   * POST /apps/invoice-ingestion/process
   */
  router.post('/process', async (req, res) => {
    try {
      const filter = req.body.filter || {};
      await app.processInvoices(filter);

      res.json({
        success: true,
        message: 'Invoice ingestion completed',
      });
    } catch (error) {
      console.error('Invoice ingestion failed:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get Gmail OAuth URL
   * GET /apps/invoice-ingestion/auth/gmail
   */
  router.get('/auth/gmail', (req, res) => {
    const emailService = (app as any).emailService;
    const authUrl = emailService.getAuthUrl();

    res.json({ authUrl });
  });

  return router;
}
