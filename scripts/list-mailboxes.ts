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

  imap.getBoxes((err, boxes) => {
    if (err) {
      console.error('❌ Error listing mailboxes:', err);
      imap.end();
      return;
    }

    console.log('📁 Available mailboxes:');
    const printBoxes = (boxes: any, indent = '') => {
      for (const [name, box] of Object.entries(boxes)) {
        console.log(`${indent}${name}`);
        if (box && typeof box === 'object' && 'children' in box && box.children) {
          printBoxes(box.children, indent + '  ');
        }
      }
    };
    printBoxes(boxes);

    imap.end();
  });
});

imap.once('error', (err: Error) => {
  console.error('❌ IMAP error:', err);
  process.exit(1);
});

imap.connect();
