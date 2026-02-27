import 'dotenv/config';
import { Pool } from 'pg';
import { EmailManagementService } from '../services/EmailManagementService';

/**
 * Process all labeled emails (receipts and invoices) that haven't been processed yet
 */
async function processLabeledEmails() {
  console.log('🚀 Starting labeled email processing...\n');

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

    // Find all labeled emails without incoming_invoices
    const result = await pool.query(`
      SELECT id, subject, label
      FROM emails
      WHERE label IN ('receipt', 'incoming_invoice')
        AND NOT EXISTS (
          SELECT 1 FROM incoming_invoices WHERE email_id = emails.id
        )
      ORDER BY id
    `);

    console.log(`📧 Found ${result.rows.length} labeled emails to process\n`);

    let processed = 0;
    let failed = 0;

    for (const email of result.rows) {
      try {
        console.log(`Processing #${email.id}: ${email.subject} [${email.label}]`);

        // Re-trigger the label update which will process the email
        await emailService.updateEmailLabel(email.id, email.label);

        processed++;
        console.log(`✅ Processed email #${email.id}\n`);
      } catch (error) {
        failed++;
        console.error(`❌ Failed to process email #${email.id}:`, error);
        console.log('');
      }
    }

    console.log('\n✅ Done!');
    console.log(`📊 Results:`);
    console.log(`  - Processed: ${processed}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Total: ${result.rows.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

processLabeledEmails();