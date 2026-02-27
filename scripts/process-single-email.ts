import 'dotenv/config';
import { Pool } from 'pg';
import { EmailManagementService } from '../services/EmailManagementService';

async function processSingleEmail() {
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '54322'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const emailService = new EmailManagementService(pool, {
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
    });

    console.log('Processing email ID 85...');
    await emailService.updateEmailLabel(85, 'incoming_invoice');
    console.log('Done!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

processSingleEmail();
