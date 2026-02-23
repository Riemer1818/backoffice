import 'dotenv/config';
import { Pool } from 'pg';
import { EmailManagementService } from '../services/EmailManagementService';

/**
 * Script to fetch all unread emails from IMAP and save to database
 */
async function fetchEmails() {
  console.log('🚀 Starting email fetch...\n');

  // Create database pool
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '54322'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    // Initialize email service
    const emailService = new EmailManagementService(pool, {
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
    });

    console.log('📧 Fetching unread emails from IMAP...');
    const savedEmails = await emailService.fetchAndSaveUnreadEmails();

    console.log('\n✅ Done!');
    console.log(`📊 Results: ${savedEmails.length} new emails saved`);

    if (savedEmails.length > 0) {
      console.log('\n📬 Saved emails:');
      savedEmails.forEach((email, i) => {
        console.log(`  ${i + 1}. [${email.from_address}] ${email.subject}`);
        console.log(`     📎 ${email.attachment_count} attachment(s)`);
        console.log(`     🔗 Email ID: ${email.id}`);
      });
    }

    // Show statistics
    const stats = await emailService.getStats();
    console.log('\n📈 Email Statistics:');
    console.log(`  Total emails: ${stats.total}`);
    console.log(`  Unread: ${stats.unread}`);
    console.log(`  Processed: ${stats.processed}`);
    console.log(`  Pending: ${stats.pending}`);
    console.log(`  Failed: ${stats.failed}`);
    console.log(`  With attachments: ${stats.with_attachments}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
fetchEmails();
