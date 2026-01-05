import { EmailService, Email, EmailFilter } from '../../core/email/EmailService';
import { DocumentParser } from '../../core/parsers/DocumentParser';
import { LLMService } from '../../core/llm/LLMService';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { Pool } from 'pg';

export interface InvoiceData {
  vendor: string;
  date: string;
  amount: number;
  vatAmount?: number;
  description: string;
  invoiceNumber?: string;
}

const INVOICE_SCHEMA = `{
  "vendor": "string (company/supplier name)",
  "date": "string (YYYY-MM-DD format)",
  "amount": "number (total amount including VAT)",
  "vatAmount": "number (VAT amount if specified)",
  "description": "string (brief description)",
  "invoiceNumber": "string (invoice/reference number if present)"
}`;

/**
 * Invoice Ingestion App
 * Automatically fetches invoices from email, extracts data, and creates expense records
 */
export class InvoiceIngestionApp {
  private emailService: EmailService;
  private documentParser: DocumentParser;
  private llmService: LLMService;
  private expenseRepository: ExpenseRepository;

  constructor(dbPool: Pool) {
    this.emailService = new EmailService();
    this.documentParser = new DocumentParser();
    this.llmService = new LLMService();
    this.expenseRepository = new ExpenseRepository(dbPool);
  }

  /**
   * Process invoices from email
   */
  async processInvoices(filter?: EmailFilter): Promise<void> {
    console.log('🔍 Fetching invoices from email...');

    const defaultFilter: EmailFilter = {
      hasAttachment: true,
      unreadOnly: true,
      ...filter,
    };

    const emails = await this.emailService.fetchEmails(defaultFilter);
    console.log(`📧 Found ${emails.length} emails with attachments`);

    for (const email of emails) {
      try {
        await this.processEmail(email);
      } catch (error) {
        console.error(`Failed to process email ${email.id}:`, error);
      }
    }

    console.log('✅ Invoice ingestion complete');
  }

  /**
   * Process a single email
   */
  private async processEmail(email: Email): Promise<void> {
    console.log(`\n📨 Processing: ${email.subject}`);

    for (const attachment of email.attachments) {
      // Skip non-invoice attachments
      if (!this.isInvoiceAttachment(attachment.filename, attachment.mimeType)) {
        continue;
      }

      console.log(`  📄 Processing attachment: ${attachment.filename}`);

      try {
        const invoiceData = await this.extractInvoiceData(
          attachment.data,
          attachment.mimeType
        );

        await this.createExpenseRecord(invoiceData, attachment, email);

        console.log(`  ✅ Created expense: ${invoiceData.vendor} - €${invoiceData.amount}`);
      } catch (error) {
        console.error(`  ❌ Failed to process attachment:`, error);
      }
    }

    // Mark email as processed
    await this.emailService.markAsRead(email.id);
  }

  /**
   * Extract invoice data from document
   */
  private async extractInvoiceData(
    buffer: Buffer,
    mimeType: string
  ): Promise<InvoiceData> {
    // Parse document to text
    const parsed = await this.documentParser.parse(buffer, mimeType);

    if (!parsed.text.trim()) {
      throw new Error('No text content found in document');
    }

    // Extract structured data using LLM
    const invoiceData = await this.llmService.extractStructured<InvoiceData>(
      parsed.text,
      INVOICE_SCHEMA,
      { metadata: { app: 'invoice-ingestion' } }
    );

    return invoiceData;
  }

  /**
   * Create expense record in database
   */
  private async createExpenseRecord(
    invoiceData: InvoiceData,
    attachment: any,
    email: Email
  ): Promise<void> {
    // Store original extracted data for review
    const extractedData = JSON.stringify(invoiceData);

    await this.expenseRepository.create({
      date: new Date(invoiceData.date),
      amount: invoiceData.amount,
      vat_amount: invoiceData.vatAmount || null,
      description: invoiceData.description,
      category: 'Operational', // Default category
      receipt_file: attachment.data,
      receipt_filename: attachment.filename,
      receipt_size: attachment.size,
      notes: `Auto-imported from email: ${email.subject}\nVendor: ${invoiceData.vendor}${
        invoiceData.invoiceNumber ? `\nInvoice #: ${invoiceData.invoiceNumber}` : ''
      }`,
      review_status: 'pending_review', // Mark for human review
      extracted_data: extractedData,
    });
  }

  /**
   * Check if attachment looks like an invoice
   */
  private isInvoiceAttachment(filename: string, mimeType: string): boolean {
    const invoiceKeywords = ['invoice', 'facture', 'factuur', 'receipt', 'bill'];
    const lowerFilename = filename.toLowerCase();

    const hasInvoiceKeyword = invoiceKeywords.some((kw) => lowerFilename.includes(kw));
    const isPDF = mimeType === 'application/pdf';

    return hasInvoiceKeyword && isPDF;
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    await this.llmService.shutdown();
  }
}
