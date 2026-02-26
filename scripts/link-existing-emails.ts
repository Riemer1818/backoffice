import { Pool } from 'pg';
import { EmailRepository } from '../repositories/EmailRepository';

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function linkExistingEmails() {
  console.log('Starting to link existing emails to companies/contacts...\n');

  const emailRepo = new EmailRepository(pool);

  // Get all emails that don't have company/contact links
  const result = await pool.query(
    `SELECT id, from_address, subject
     FROM emails
     WHERE linked_company_id IS NULL AND linked_contact_id IS NULL
     ORDER BY email_date DESC`
  );

  const unlinkedEmails = result.rows;
  console.log(`Found ${unlinkedEmails.length} unlinked emails\n`);

  let linkedCount = 0;
  let skippedCount = 0;

  for (const email of unlinkedEmails) {
    console.log(`Processing email ${email.id}: ${email.subject}`);
    console.log(`  From: ${email.from_address}`);

    // Try to auto-match
    const match = await emailRepo.autoMatchCompanyContact(email.from_address);

    if (match.companyId || match.contactId) {
      // Update the email with the links
      await pool.query(
        `UPDATE emails
         SET linked_company_id = $1, linked_contact_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [match.companyId, match.contactId, email.id]
      );

      console.log(`  ✅ Linked to: Company ${match.companyId}, Contact ${match.contactId}\n`);
      linkedCount++;
    } else {
      console.log(`  ⏭️  No match found\n`);
      skippedCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total emails processed: ${unlinkedEmails.length}`);
  console.log(`Successfully linked: ${linkedCount}`);
  console.log(`No match found: ${skippedCount}`);

  await pool.end();
}

linkExistingEmails()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
