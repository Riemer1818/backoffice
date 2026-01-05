import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { InvoiceIngestionApp } from './apps/invoice-ingestion/InvoiceIngestionApp';
import { Pool } from 'pg';

const app = express();

// Database connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'tRPC server is running' });
});

// tRPC endpoint
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`🚀 tRPC server running on http://localhost:${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);

  // Start automated invoice ingestion (every 30 minutes)
  console.log('📧 Starting automated invoice ingestion scheduler (every 30 minutes)...');

  cron.schedule('*/30 * * * *', async () => {
    console.log('\n⏰ [Scheduled] Running invoice ingestion...');
    try {
      const ingestionApp = new InvoiceIngestionApp(dbPool);
      await ingestionApp.processInvoices();
      console.log('✅ [Scheduled] Invoice ingestion completed\n');
    } catch (error) {
      console.error('❌ [Scheduled] Invoice ingestion failed:', error);
    }
  });

  console.log('✅ Automated invoice ingestion scheduler started');
});
