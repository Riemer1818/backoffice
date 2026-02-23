import 'dotenv/config';
import { Pool } from 'pg';
import { ImapEmailService } from '../core/email/ImapEmailService';
import { EmailRepository } from '../repositories/EmailRepository';

/**
 * Script to fetch ALL emails (read + unread) from IMAP and save to database
 */
async function fetchAllEmails() {
  console.log('🚀 Fetching ALL emails (read + unread)...\n');

  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '54322'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    const imapService = new ImapEmailService({
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
    });
    const emailRepo = new EmailRepository(pool);

    console.log('📧 Connecting to IMAP and fetching ALL emails...');
    const imapEmails = await imapService.fetchEmails(['ALL']);
    console.log(`📬 Found ${imapEmails.length} total emails\n`);

    const savedEmails = [];
    let skipped = 0;

    for (let i = 0; i < imapEmails.length; i++) {
      const imapEmail = imapEmails[i];

      try {
        const exists = await emailRepo.existsByUid(imapEmail.id);
        if (exists) {
          skipped++;
          continue;
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const emailRecord = await emailRepo.create(
            {
              email_uid: imapEmail.id,
              subject: imapEmail.subject,
              from_address: imapEmail.from,
              to_address: imapEmail.to,
              cc_address: imapEmail.cc,
              bcc_address: imapEmail.bcc,
              email_date: imapEmail.date,
              body_text: imapEmail.body,
              body_html: imapEmail.htmlBody,
              is_read: imapEmail.isRead,
              has_attachments: imapEmail.attachments.length > 0,
              attachment_count: imapEmail.attachments.length,
            },
            client
          );

          for (const attachment of imapEmail.attachments) {
            await emailRepo.createAttachment(
              {
                email_id: emailRecord.id,
                filename: attachment.filename,
                mime_type: attachment.mimeType,
                file_size: attachment.size,
                file_data: attachment.data,
              },
              client
            );
          }

          await client.query('COMMIT');
          savedEmails.push(emailRecord);

          if (savedEmails.length % 10 === 0) {
            console.log(`  Progress: ${savedEmails.length} saved, ${skipped} skipped (${i + 1}/${imapEmails.length})...`);
          }
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(`❌ Failed to save email:`, error);
      }
    }

    console.log('\n✅ Done!');
    console.log(`📊 Results: ${savedEmails.length} new, ${skipped} already existed`);

    const stats = await emailRepo.getStats();
    console.log('\n📈 Database Statistics:');
    console.log(`  Total emails: ${stats.total}`);
    console.log(`  With attachments: ${stats.with_attachments}`);
    console.log(`  Pending processing: ${stats.pending}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fetchAllEmails();
