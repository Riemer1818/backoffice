import { ImapEmailService } from './core/email/ImapEmailService';
import { InvoiceEmailProcessor } from './core/email/InvoiceEmailProcessor';
import * as dotenv from 'dotenv';

dotenv.config();

async function debugEmails() {
  console.log('🔍 DEBUG: Checking email configuration...\n');

  const emailService = new ImapEmailService({
    user: process.env.IMAP_USER!,
    password: process.env.IMAP_PASSWORD!,
    host: process.env.IMAP_HOST!,
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: process.env.IMAP_TLS !== 'false',
  });

  console.log('📧 Fetching unread emails...\n');
  const emails = await emailService.fetchUnreadEmails();

  console.log(`Found ${emails.length} unread emails\n`);
  console.log('=' .repeat(80));

  for (const email of emails) {
    console.log(`\n📨 Email ID: ${email.id}`);
    console.log(`   Subject: ${email.subject}`);
    console.log(`   From: ${email.from}`);
    console.log(`   Date: ${email.date}`);
    console.log(`   Attachments: ${email.attachments.length}`);

    if (email.attachments.length > 0) {
      email.attachments.forEach((att, idx) => {
        console.log(`      ${idx + 1}. ${att.filename} (${att.mimeType}) - ${att.size} bytes`);
      });
    }

    // Check keywords
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();

    const invoiceKeywords = [
      'facture',
      'factuur',
      'invoice',
      'receipt',
      'bon',
      'rekening',
      'betaling',
      'payment',
      'betalingsverzoek'
    ];

    const matchedKeywords = invoiceKeywords.filter(keyword =>
      subject.includes(keyword) || body.includes(keyword)
    );

    console.log(`   Keywords matched: ${matchedKeywords.length > 0 ? matchedKeywords.join(', ') : 'NONE'}`);

    // Check valid attachments
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const validAttachments = email.attachments.filter(att => {
      const filename = att.filename.toLowerCase();
      return validExtensions.some(ext => filename.endsWith(ext));
    });

    console.log(`   Valid attachments: ${validAttachments.length}`);

    const isInvoice = matchedKeywords.length > 0 && validAttachments.length > 0;
    console.log(`   ✅ Would be processed: ${isInvoice ? 'YES' : 'NO'}`);

    if (!isInvoice) {
      if (matchedKeywords.length === 0) {
        console.log(`   ❌ Reason: No invoice keywords found`);
      }
      if (validAttachments.length === 0) {
        console.log(`   ❌ Reason: No valid attachments (PDF/images)`);
      }
    }

    console.log('   Body preview:', email.body.substring(0, 200).replace(/\n/g, ' ') + '...');
    console.log('=' .repeat(80));
  }
}

debugEmails().catch(console.error);
