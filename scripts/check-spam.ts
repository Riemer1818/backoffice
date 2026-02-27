import 'dotenv/config';
import { ImapEmailService } from '../core/email/ImapEmailService';

async function checkSpam() {
  const emailService = new ImapEmailService({
    user: process.env.IMAP_USER || '',
    password: process.env.IMAP_PASSWORD || '',
    host: process.env.IMAP_HOST || '',
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
  });

  console.log('Fetching ALL emails...');
  const allEmails = await emailService.fetchUnreadEmails();

  console.log(`\nTotal emails found: ${allEmails.length}`);

  const klupEmails = allEmails.filter(e =>
    e.subject.includes('Klup') ||
    e.subject.includes('F00248') ||
    e.from.includes('klup')
  );

  console.log(`\nKlup-related emails: ${klupEmails.length}`);
  klupEmails.forEach(e => {
    console.log(`  - UID ${e.id}: ${e.subject} (from: ${e.from}, date: ${e.date})`);
  });
}

checkSpam().catch(console.error);
