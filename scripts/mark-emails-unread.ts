import 'dotenv/config';
import Imap from 'imap';

const imapConfig = {
  user: process.env.IMAP_USER || '',
  password: process.env.IMAP_PASSWORD || '',
  host: process.env.IMAP_HOST || '',
  port: parseInt(process.env.IMAP_PORT || '993'),
  tls: true,
  tlsOptions: {
    rejectUnauthorized: false,
  }
};

console.log('📬 Connecting to IMAP...');
const imap = new Imap(imapConfig);

imap.once('ready', () => {
  console.log('✅ Connected!\n');

  imap.openBox('INBOX', false, (err) => {
    if (err) {
      console.error('❌ Error opening inbox:', err);
      imap.end();
      return;
    }

    // Search for all emails
    imap.search(['ALL'], (err, uids) => {
      if (err) {
        console.error('❌ Error searching:', err);
        imap.end();
        return;
      }

      if (!uids || uids.length === 0) {
        console.log('No emails found after January 13th');
        imap.end();
        return;
      }

      console.log(`Found ${uids.length} emails after January 13th`);
      console.log('Marking them as unread...');

      // Remove \Seen flag (mark as unread)
      imap.delFlags(uids, ['\\Seen'], (err) => {
        if (err) {
          console.error('❌ Error marking as unread:', err);
        } else {
          console.log(`✅ Marked ${uids.length} emails as unread`);
        }
        imap.end();
      });
    });
  });
});

imap.once('error', (err: Error) => {
  console.error('❌ IMAP error:', err);
  process.exit(1);
});

imap.connect();
