import Imap from 'imap';
// @ts-ignore - mailparser doesn't have types
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { EventEmitter } from 'events';

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
  size: number;
}

export interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  body: string;
  htmlBody?: string;
  attachments: EmailAttachment[];
}

export interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

/**
 * IMAP-based email service for neo.space and other IMAP providers
 * Supports fetching unread emails, marking as read, and extracting attachments
 */
export class ImapEmailService extends EventEmitter {
  private config: ImapConfig;
  private imap: Imap | null = null;

  constructor(config: ImapConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to IMAP server
   */
  private connect(): Promise<Imap> {
    return new Promise((resolve, reject) => {
      const imapOptions = {
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: {
          rejectUnauthorized: false,
          servername: this.config.host
        },
        authTimeout: 10000,
        connTimeout: 10000
      };

      const imap = new Imap(imapOptions);

      imap.once('ready', () => {
        this.imap = imap;
        resolve(imap);
      });

      imap.once('error', (err: Error) => {
        reject(err);
      });

      imap.connect();
    });
  }

  /**
   * Open mailbox
   */
  private openBox(boxName: string = 'INBOX'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      this.imap.openBox(boxName, false, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Fetch unread emails
   */
  async fetchUnreadEmails(): Promise<Email[]> {
    const imap = await this.connect();
    await this.openBox();

    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      // Search for unread emails
      this.imap.search(['UNSEEN'], (err, uids) => {
        if (err) {
          this.disconnect();
          reject(err);
          return;
        }

        if (!uids || uids.length === 0) {
          this.disconnect();
          resolve([]);
          return;
        }

        const emails: Email[] = [];
        const parsePromises: Promise<void>[] = [];

        const fetch = this.imap!.fetch(uids, {
          bodies: '',
          markSeen: false, // Don't auto-mark as read
        });

        fetch.on('message', (msg: any, seqno: number) => {
          msg.on('body', (stream: any) => {
            const parsePromise = new Promise<void>((resolveMsg) => {
              simpleParser(stream, async (err: any, parsed: any) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  resolveMsg();
                  return;
                }

                emails.push(this.parsedMailToEmail(parsed, String(seqno)));
                resolveMsg();
              });
            });
            parsePromises.push(parsePromise);
          });
        });

        fetch.once('error', (err) => {
          this.disconnect();
          reject(err);
        });

        fetch.once('end', async () => {
          // Wait for all email parsing to complete
          await Promise.all(parsePromises);
          this.disconnect();
          resolve(emails);
        });
      });
    });
  }

  /**
   * Fetch emails matching criteria
   */
  async fetchEmails(criteria: string[] = ['ALL']): Promise<Email[]> {
    const imap = await this.connect();
    await this.openBox();

    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      this.imap.search(criteria, (err, uids) => {
        if (err) {
          this.disconnect();
          reject(err);
          return;
        }

        if (!uids || uids.length === 0) {
          this.disconnect();
          resolve([]);
          return;
        }

        const emails: Email[] = [];
        const parsePromises: Promise<void>[] = [];

        const fetch = this.imap!.fetch(uids, {
          bodies: '',
        });

        fetch.on('message', (msg: any, seqno: number) => {
          msg.on('body', (stream: any) => {
            const parsePromise = new Promise<void>((resolveMsg) => {
              simpleParser(stream, async (err: any, parsed: any) => {
                if (err) {
                  console.error('Error parsing email:', err);
                  resolveMsg();
                  return;
                }

                emails.push(this.parsedMailToEmail(parsed, String(seqno)));
                resolveMsg();
              });
            });
            parsePromises.push(parsePromise);
          });
        });

        fetch.once('error', (err) => {
          this.disconnect();
          reject(err);
        });

        fetch.once('end', async () => {
          // Wait for all email parsing to complete
          await Promise.all(parsePromises);
          this.disconnect();
          resolve(emails);
        });
      });
    });
  }

  /**
   * Mark email as read by UID
   */
  async markAsRead(uid: string): Promise<void> {
    console.log(`📧 Marking email UID ${uid} as read...`);
    const imap = await this.connect();
    await this.openBox();

    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP not connected'));
        return;
      }

      // addFlags expects UID or array of UIDs
      this.imap.addFlags([uid], ['\\Seen'], (err) => {
        if (err) {
          console.error(`❌ Failed to mark UID ${uid} as read:`, err);
          this.disconnect();
          reject(err);
        } else {
          console.log(`✅ Successfully marked UID ${uid} as read`);
          this.disconnect();
          resolve();
        }
      });
    });
  }

  /**
   * Convert ParsedMail to Email interface
   */
  private parsedMailToEmail(parsed: ParsedMail, id: string): Email {
    const attachments: EmailAttachment[] = [];

    if (parsed.attachments) {
      for (const att of parsed.attachments) {
        attachments.push({
          filename: att.filename || 'unnamed',
          mimeType: att.contentType,
          data: att.content,
          size: att.size,
        });
      }
    }

    return {
      id,
      subject: parsed.subject || '',
      from: this.extractEmail(parsed.from),
      to: this.extractEmail(parsed.to),
      date: parsed.date || new Date(),
      body: parsed.text || '',
      htmlBody: parsed.html || undefined,
      attachments,
    };
  }

  /**
   * Extract email address from address object
   */
  private extractEmail(addressObj: any): string {
    if (!addressObj) return '';
    if (typeof addressObj === 'string') return addressObj;
    if (Array.isArray(addressObj) && addressObj.length > 0) {
      return addressObj[0].address || '';
    }
    if (addressObj.value && Array.isArray(addressObj.value)) {
      return addressObj.value[0]?.address || '';
    }
    return '';
  }

  /**
   * Disconnect from IMAP server
   */
  private disconnect() {
    if (this.imap) {
      this.imap.end();
      this.imap = null;
    }
  }
}
