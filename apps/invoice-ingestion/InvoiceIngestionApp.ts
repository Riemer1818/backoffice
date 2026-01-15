import { ImapEmailService, Email, EmailAttachment } from '../../core/email/ImapEmailService';
import { DocumentParser } from '../../core/parsers/DocumentParser';
import { LLMService } from '../../core/llm/LLMService';
import { ExpenseRepository } from '../../repositories/ExpenseRepository';
import { CurrencyConverter } from '../../core/currency/CurrencyConverter';
import { Pool } from 'pg';

export interface InvoiceData {
  vendor: string;
  date: string;
  amount: number;
  vatAmount?: number;
  description: string;
  invoiceNumber?: string;
  currency?: string;
  language?: string;
}

const INVOICE_SCHEMA = `{
  "vendor": "string (company/supplier name)",
  "date": "string (YYYY-MM-DD format)",
  "amount": "number (total amount including VAT)",
  "vatAmount": "number (VAT amount if specified)",
  "description": "string (brief description)",
  "invoiceNumber": "string (invoice/reference number if present)",
  "currency": "string (CRITICAL: Look for currency symbols ($, £, ¥, S$, etc.) or currency codes (USD, GBP, SGD, JPY, CHF, CAD, AUD, EUR) in the invoice. Return the 3-letter ISO currency code. Common symbols: $ = USD, £ = GBP, S$ = SGD, ¥ = JPY/CNY, € = EUR. If you see a dollar sign check if it's US, Singapore, Canadian, or Australian dollars from context. Only use EUR if you actually see € or EUR in the invoice.)",
  "language": "string (2-letter ISO 639-1 language code like en, nl, fr, de, es - detect from the invoice text)"
}`;

/**
 * Invoice Ingestion App
 * Automatically fetches invoices from email via IMAP, extracts data, and creates expense records
 */
export class InvoiceIngestionApp {
  private emailService: ImapEmailService;
  private documentParser: DocumentParser;
  private llmService: LLMService;
  private expenseRepository: ExpenseRepository;
  private currencyConverter: CurrencyConverter;
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;

    // Initialize IMAP email service with credentials from .env
    this.emailService = new ImapEmailService({
      user: process.env.IMAP_USER || '',
      password: process.env.IMAP_PASSWORD || '',
      host: process.env.IMAP_HOST || '',
      port: parseInt(process.env.IMAP_PORT || '993'),
      tls: true,
    });

    this.documentParser = new DocumentParser();
    this.llmService = new LLMService();
    this.currencyConverter = new CurrencyConverter();
    this.expenseRepository = new ExpenseRepository(dbPool);
  }

  /**
   * Process invoices from unread emails
   */
  async processInvoices(): Promise<void> {
    console.log('🔍 Fetching unread emails from IMAP...');

    try {
      const emails = await this.emailService.fetchUnreadEmails();
      console.log(`📧 Found ${emails.length} unread emails`);

      for (const email of emails) {
        try {
          await this.processEmail(email);
        } catch (error) {
          console.error(`Failed to process email ${email.id}:`, error);
        }
      }

      console.log('✅ Invoice ingestion complete');
    } catch (error) {
      console.error('❌ Failed to fetch emails:', error);
      throw error;
    }
  }

  /**
   * Process a single email - creates ONE invoice with multiple attachments
   */
  private async processEmail(email: Email): Promise<void> {
    console.log(`\n📨 Processing: ${email.subject}`);

    // Check if email has attachments
    if (!email.attachments || email.attachments.length === 0) {
      console.log('  ⏭️  No attachments, skipping');
      return;
    }

    // Filter invoice attachments
    const invoiceAttachments = email.attachments.filter(att => this.isInvoiceAttachment(att));

    if (invoiceAttachments.length === 0) {
      console.log('  ⏭️  No invoice attachments, skipping');
      return;
    }

    // Check if this email was already processed (deduplication by email ID)
    const isDuplicate = await this.checkIfEmailAlreadyProcessed(email.id);
    if (isDuplicate) {
      console.log(`  ⏭️  Already processed this email (${invoiceAttachments.length} attachments)`);
      return;
    }

    console.log(`  📄 Found ${invoiceAttachments.length} invoice attachment(s)`);

    try {
      // Pick the primary invoice (prefer "invoice" over "receipt")
      const primaryAttachment = this.selectPrimaryInvoice(invoiceAttachments);
      console.log(`  📋 Using primary: ${primaryAttachment.filename}`);

      // Extract invoice data from primary attachment with email context
      const invoiceData = await this.extractInvoiceData(
        primaryAttachment.data,
        primaryAttachment.mimeType,
        email
      );

      // Create ONE expense record with ALL attachments
      await this.createExpenseWithAttachments(invoiceData, invoiceAttachments, email);

      console.log(`  ✅ Created expense: ${invoiceData.vendor} - €${invoiceData.amount} (${invoiceAttachments.length} files)`);
    } catch (error) {
      console.error(`  ❌ Failed to process email:`, error);
    }

    // Mark email as read after processing
    try {
      await this.emailService.markAsRead(email.id);
      console.log(`  📬 Marked as read`);
    } catch (error) {
      console.error(`  ⚠️  Failed to mark as read:`, error);
    }
  }

  /**
   * Select the primary invoice from multiple attachments
   * Prefer files with "invoice" in the name over "receipt"
   */
  private selectPrimaryInvoice(attachments: EmailAttachment[]): EmailAttachment {
    const invoiceFile = attachments.find(att =>
      att.filename.toLowerCase().includes('invoice')
    );

    return invoiceFile || attachments[0];
  }

  /**
   * Extract invoice data from document with email context
   */
  private async extractInvoiceData(
    buffer: Buffer,
    mimeType: string,
    email: Email
  ): Promise<InvoiceData> {
    // Parse document to text
    const parsed = await this.documentParser.parse(buffer, mimeType);

    if (!parsed.text.trim()) {
      throw new Error('No text content found in document');
    }

    // Combine email context with PDF text for better extraction
    const fullContext = `EMAIL CONTEXT:
Subject: ${email.subject}
From: ${email.from}
Body: ${email.body || '(no body)'}

INVOICE DOCUMENT:
${parsed.text}`;

    // STEP 1: First identify currency and language explicitly
    console.log('  🔍 Step 1: Detecting currency and language...');
    const currencySchema = `{
  "currency": "string (3-letter ISO code: USD, EUR, GBP, SGD, JPY, CHF, CAD, AUD, etc.)",
  "language": "string (2-letter ISO code: en, nl, fr, de, es, etc.)"
}`;

    const currencyPrompt = `Look at this invoice and email. What currency and language is it in?

INSTRUCTIONS:
- Look for currency SYMBOLS: $, £, €, ¥, S$, C$, A$
- Look for currency CODES: USD, EUR, GBP, SGD, JPY, CHF, CAD, AUD
- Check the sender's location/country for context
- If you see "$" determine if it's USD, SGD, CAD, or AUD from context (location, S$ prefix, etc.)
- For language, detect from the text content

${fullContext}`;

    const currencyInfo = await this.llmService.extractStructured<{ currency: string; language: string }>(
      currencyPrompt,
      currencySchema,
      { metadata: { app: 'invoice-ingestion-currency' } }
    );

    console.log(`  💱 Detected: ${currencyInfo.currency} (${currencyInfo.language})`);

    // STEP 2: Extract full invoice data with currency already known
    console.log('  📋 Step 2: Extracting invoice details...');
    const invoiceData = await this.llmService.extractStructured<InvoiceData>(
      fullContext,
      INVOICE_SCHEMA,
      { metadata: { app: 'invoice-ingestion' } }
    );

    // Override currency and language with step 1 results
    invoiceData.currency = currencyInfo.currency;
    invoiceData.language = currencyInfo.language;

    return invoiceData;
  }

  /**
   * Check if this email was already processed (by email ID only)
   */
  private async checkIfEmailAlreadyProcessed(emailId: string): Promise<boolean> {
    const result = await this.dbPool.query(
      `SELECT id FROM incoming_invoices
       WHERE source_email_id = $1
       LIMIT 1`,
      [emailId]
    );
    return result.rows.length > 0;
  }

  /**
   * Find or create supplier company based on vendor name
   */
  private async findOrCreateSupplier(vendorName: string, client: any): Promise<number | null> {
    // Try exact match first (case-insensitive)
    let result = await client.query(
      `SELECT id, name FROM companies
       WHERE LOWER(name) = LOWER($1)
       AND type IN ('supplier', 'both')
       LIMIT 1`,
      [vendorName]
    );

    if (result.rows.length > 0) {
      console.log(`  🔗 Matched to existing supplier: ${result.rows[0].name}`);
      return result.rows[0].id;
    }

    // Try partial match (vendor name contains or is contained in company name)
    result = await client.query(
      `SELECT id, name FROM companies
       WHERE (LOWER(name) LIKE LOWER($1) OR LOWER($1) LIKE LOWER(name))
       AND type IN ('supplier', 'both')
       ORDER BY LENGTH(name)
       LIMIT 1`,
      [`%${vendorName}%`]
    );

    if (result.rows.length > 0) {
      console.log(`  🔗 Fuzzy matched to existing supplier: ${result.rows[0].name}`);
      return result.rows[0].id;
    }

    // No match found - create new supplier
    console.log(`  ➕ Creating new supplier: ${vendorName}`);
    const insertResult = await client.query(
      `INSERT INTO companies (name, type, is_active)
       VALUES ($1, 'supplier', true)
       RETURNING id`,
      [vendorName]
    );

    return insertResult.rows[0].id;
  }

  /**
   * Create expense record with multiple attachments
   */
  private async createExpenseWithAttachments(
    invoiceData: InvoiceData,
    attachments: EmailAttachment[],
    email: Email
  ): Promise<void> {
    console.log(`  📝 Storing invoice with ${attachments.length} attachment(s)`);

    // Start transaction
    const client = await this.dbPool.connect();

    try {
      await client.query('BEGIN');

      // Find or create supplier
      const supplierId = await this.findOrCreateSupplier(invoiceData.vendor, client);

      // Sanitize text fields to remove null bytes and invalid UTF-8
      const sanitize = (str: string): string => {
        return str.replace(/\0/g, '').replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
      };

      // Currency conversion
      const currency = invoiceData.currency || 'EUR';
      const originalAmount = invoiceData.amount;
      let convertedAmount = originalAmount;
      let convertedSubtotal = invoiceData.amount - (invoiceData.vatAmount || 0);
      let convertedVat = invoiceData.vatAmount || 0;
      let exchangeRate = 1.0;

      if (currency.toUpperCase() !== 'EUR') {
        console.log(`  💱 Converting ${currency} ${originalAmount} to EUR (date: ${invoiceData.date})`);
        const conversion = await this.currencyConverter.convert(
          originalAmount,
          currency,
          'EUR',
          invoiceData.date
        );
        convertedAmount = conversion.convertedAmount;
        exchangeRate = conversion.rate;

        // Convert subtotal and VAT proportionally
        const ratio = convertedAmount / originalAmount;
        convertedSubtotal = (invoiceData.amount - (invoiceData.vatAmount || 0)) * ratio;
        convertedVat = (invoiceData.vatAmount || 0) * ratio;

        console.log(`  ✅ Converted: €${convertedAmount.toFixed(2)} (rate: ${exchangeRate.toFixed(4)})`);
      }

      // Create the incoming invoice record (without file data)
      const invoiceResult = await client.query(
        `INSERT INTO incoming_invoices (supplier_id, project_id, category_id, tax_rate_id,
                                       invoice_date, description, subtotal, tax_amount, total_amount,
                                       notes, supplier_name,
                                       review_status, payment_status, source,
                                       source_email_id, source_email_subject, source_email_from, source_email_date,
                                       original_currency, original_amount, original_subtotal, original_tax_amount,
                                       exchange_rate, exchange_rate_date, language)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
         RETURNING id`,
        [
          supplierId, // supplier_id (now linked!)
          null, // project_id
          null, // category_id
          null, // tax_rate_id
          new Date(invoiceData.date),
          sanitize(invoiceData.description),
          convertedSubtotal, // subtotal in EUR
          convertedVat, // tax_amount in EUR
          convertedAmount, // total_amount in EUR
          sanitize(`Auto-imported from email: ${email.subject}\nVendor: ${invoiceData.vendor}${
            invoiceData.invoiceNumber ? `\nInvoice #: ${invoiceData.invoiceNumber}` : ''
          }${currency !== 'EUR' ? `\nOriginal: ${currency} ${originalAmount.toFixed(2)}` : ''}`),
          sanitize(invoiceData.vendor), // supplier_name
          'pending', // review_status
          'paid', // payment_status (default to paid)
          'email', // source
          email.id, // source_email_id
          sanitize(email.subject), // source_email_subject
          sanitize(email.from), // source_email_from
          email.date, // source_email_date
          currency, // original_currency
          originalAmount, // original_amount (total)
          invoiceData.amount - (invoiceData.vatAmount || 0), // original_subtotal
          invoiceData.vatAmount || 0, // original_tax_amount
          exchangeRate, // exchange_rate
          new Date(invoiceData.date), // exchange_rate_date
          invoiceData.language || 'en', // language
        ]
      );

      const invoiceId = invoiceResult.rows[0].id;

      // Insert all attachments
      for (const attachment of attachments) {
        const attachmentType = attachment.filename.toLowerCase().includes('receipt')
          ? 'receipt'
          : 'invoice';

        await client.query(
          `INSERT INTO invoice_attachments (incoming_invoice_id, file_data, file_name, file_type, file_size, attachment_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            invoiceId,
            attachment.data,
            attachment.filename,
            attachment.mimeType,
            attachment.size,
            attachmentType,
          ]
        );
      }

      await client.query('COMMIT');
      console.log(`  💾 Saved invoice #${invoiceId} with ${attachments.length} attachment(s)`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if attachment looks like an invoice
   */
  private isInvoiceAttachment(attachment: EmailAttachment): boolean {
    // Accept all PDFs - the email filter already checked for invoice keywords
    return attachment.mimeType === 'application/pdf';
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    await this.llmService.shutdown();
  }
}
