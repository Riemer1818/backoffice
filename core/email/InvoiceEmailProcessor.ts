import { ImapEmailService, Email, EmailAttachment } from './ImapEmailService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const InvoiceExtractor = require('../../utils/invoiceExtractor');

export interface ProcessedInvoice {
  email: Email;
  attachment: EmailAttachment;
  extractedData: any;
  savedFilePath: string;
}

export interface ProcessingResult {
  totalEmails: number;
  invoiceEmails: number;
  processedInvoices: ProcessedInvoice[];
  errors: Array<{ email: Email; error: string }>;
}

/**
 * Invoice Email Processor
 * Monitors emails for invoices/factures and automatically extracts data
 */
export class InvoiceEmailProcessor {
  private emailService: ImapEmailService;
  private invoiceExtractor: any;
  private uploadsDir: string;

  constructor(
    emailService: ImapEmailService,
    geminiApiKey: string,
    uploadsDir: string = path.join(__dirname, '../../uploads')
  ) {
    this.emailService = emailService;
    this.invoiceExtractor = new InvoiceExtractor(geminiApiKey);
    this.uploadsDir = uploadsDir;

    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Check if email is likely an invoice/facture
   * Must contain invoice keywords AND have PDF/image attachments
   */
  private isInvoiceEmail(email: Email): boolean {
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

    // Check for invoice keywords
    const hasInvoiceKeyword = invoiceKeywords.some(keyword =>
      subject.includes(keyword) || body.includes(keyword)
    );

    // Must have at least one PDF or image attachment
    const hasValidAttachment = email.attachments.some(att =>
      this.isInvoiceAttachment(att)
    );

    return hasInvoiceKeyword && hasValidAttachment;
  }

  /**
   * Check if attachment is a valid invoice document (PDF or image)
   */
  private isInvoiceAttachment(attachment: EmailAttachment): boolean {
    const filename = attachment.filename.toLowerCase();
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

    return validExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Save attachment to disk temporarily
   */
  private async saveAttachment(attachment: EmailAttachment, emailId: string): Promise<string> {
    const timestamp = Date.now();
    const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `email_${emailId}_${timestamp}_${sanitizedFilename}`;
    const filepath = path.join(this.uploadsDir, filename);

    fs.writeFileSync(filepath, attachment.data);
    return filepath;
  }

  /**
   * Process a single email with invoice attachment
   */
  private async processInvoiceEmail(email: Email): Promise<ProcessedInvoice[]> {
    const results: ProcessedInvoice[] = [];

    for (const attachment of email.attachments) {
      if (!this.isInvoiceAttachment(attachment)) {
        console.log(`Skipping non-invoice attachment: ${attachment.filename}`);
        continue;
      }

      try {
        console.log(`Processing invoice attachment: ${attachment.filename} from email: ${email.subject}`);

        // Save attachment temporarily
        const savedPath = await this.saveAttachment(attachment, email.id);

        // Extract invoice data
        const extractedData = await this.invoiceExtractor.extractFromFile(savedPath);

        console.log(`Successfully extracted data from ${attachment.filename}`);

        results.push({
          email,
          attachment,
          extractedData,
          savedFilePath: savedPath,
        });
      } catch (error: any) {
        console.error(`Failed to process attachment ${attachment.filename}:`, error.message);
        throw error;
      }
    }

    return results;
  }

  /**
   * Process all unread emails and extract invoice data
   */
  async processUnreadEmails(): Promise<ProcessingResult> {
    console.log('Fetching unread emails...');
    const emails = await this.emailService.fetchUnreadEmails();

    console.log(`Found ${emails.length} unread emails`);

    const processedInvoices: ProcessedInvoice[] = [];
    const errors: Array<{ email: Email; error: string }> = [];
    let invoiceEmailCount = 0;

    for (const email of emails) {
      console.log(`\nProcessing email: ${email.subject} from ${email.from}`);

      // Check if it's an invoice email
      if (!this.isInvoiceEmail(email)) {
        console.log('Not an invoice email, skipping');
        continue;
      }

      invoiceEmailCount++;
      console.log('Detected as invoice email!');

      // Check for attachments
      if (email.attachments.length === 0) {
        console.log('No attachments found, skipping');
        continue;
      }

      try {
        const results = await this.processInvoiceEmail(email);
        processedInvoices.push(...results);

        // Mark email as read after successful processing
        // await this.emailService.markAsRead(email.id);
        // console.log(`Marked email ${email.id} as read`);
      } catch (error: any) {
        console.error(`Error processing email ${email.subject}:`, error.message);
        errors.push({
          email,
          error: error.message,
        });
      }
    }

    return {
      totalEmails: emails.length,
      invoiceEmails: invoiceEmailCount,
      processedInvoices,
      errors,
    };
  }

  /**
   * Clean up temporary files
   */
  async cleanup(filePaths: string[]) {
    for (const filepath of filePaths) {
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log(`Cleaned up temporary file: ${filepath}`);
        }
      } catch (error: any) {
        console.error(`Failed to clean up ${filepath}:`, error.message);
      }
    }
  }
}
