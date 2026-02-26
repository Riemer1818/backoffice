import { Pool } from 'pg';
import { EmailRepository, EmailRecord, EmailFilters } from '../repositories/EmailRepository';
import { ImapEmailService, Email as ImapEmail } from '../core/email/ImapEmailService';

export interface EmailListResult {
  emails: EmailRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmailStats {
  total: number;
  unread: number;
  processed: number;
  pending: number;
  failed: number;
  with_attachments: number;
}

/**
 * Service for managing email operations
 * Orchestrates between IMAP service, email repository, and business logic
 */
export class EmailManagementService {
  private emailRepository: EmailRepository;
  private imapService: ImapEmailService;

  constructor(
    private pool: Pool,
    imapConfig: {
      user: string;
      password: string;
      host: string;
      port: number;
      tls: boolean;
    }
  ) {
    this.emailRepository = new EmailRepository(pool);
    this.imapService = new ImapEmailService(imapConfig);
  }

  /**
   * Fetch unread emails from IMAP and save to database
   * After saving, marks emails as read in IMAP
   */
  async fetchAndSaveUnreadEmails(): Promise<EmailRecord[]> {
    console.log('📧 Fetching unread emails from IMAP...');

    const imapEmails = await this.imapService.fetchUnreadEmails();
    console.log(`📬 Found ${imapEmails.length} unread emails`);

    const savedEmails: EmailRecord[] = [];

    for (const imapEmail of imapEmails) {
      try {
        // Check if email already exists
        const exists = await this.emailRepository.existsByUid(imapEmail.id);
        if (exists) {
          console.log(`⏭️  Email ${imapEmail.id} already exists, skipping`);
          continue;
        }

        // Save email to database
        const savedEmail = await this.saveEmail(imapEmail);
        savedEmails.push(savedEmail);
        console.log(`✅ Saved email: ${savedEmail.subject} (ID: ${savedEmail.id})`);

        // Mark as read in IMAP
        try {
          await this.imapService.markAsRead(imapEmail.id);
          console.log(`📧 Marked email ${imapEmail.id} as read in IMAP`);
        } catch (error) {
          console.error(`⚠️ Failed to mark email ${imapEmail.id} as read in IMAP:`, error);
          // Don't fail the whole process if marking as read fails
        }
      } catch (error) {
        console.error(`❌ Failed to save email ${imapEmail.id}:`, error);
      }
    }

    console.log(`💾 Saved ${savedEmails.length} new emails to database`);
    return savedEmails;
  }

  /**
   * Save a single email to database
   */
  async saveEmail(imapEmail: ImapEmail): Promise<EmailRecord> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create email record
      const emailRecord = await this.emailRepository.create(
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
          is_read: false,
          has_attachments: imapEmail.attachments.length > 0,
          attachment_count: imapEmail.attachments.length,
        },
        client
      );

      // Save attachments
      for (const attachment of imapEmail.attachments) {
        await this.emailRepository.createAttachment(
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

      // Auto-match to company/contact
      const match = await this.emailRepository.autoMatchCompanyContact(imapEmail.from);
      if (match.companyId || match.contactId) {
        await client.query(
          `UPDATE emails
           SET linked_company_id = $1, linked_contact_id = $2
           WHERE id = $3`,
          [match.companyId, match.contactId, emailRecord.id]
        );
        console.log(`Auto-linked email ${emailRecord.id} to company: ${match.companyId}, contact: ${match.contactId}`);
      }

      await client.query('COMMIT');

      // Return updated record with links
      const updatedRecord = await this.emailRepository.findById(emailRecord.id);
      return updatedRecord || emailRecord;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get email by ID
   */
  async getEmailById(id: number): Promise<EmailRecord | null> {
    return this.emailRepository.findById(id);
  }

  /**
   * Get email by UID
   */
  async getEmailByUid(uid: string): Promise<EmailRecord | null> {
    return this.emailRepository.findByUid(uid);
  }

  /**
   * List emails with pagination and filters
   */
  async listEmails(
    filters: EmailFilters = {},
    page: number = 1,
    pageSize: number = 50,
    showUnlabeledOnly: boolean = true
  ): Promise<EmailListResult> {
    const offset = (page - 1) * pageSize;

    const effectiveFilters = { ...filters };

    // By default, only show unlabeled emails (NULL label)
    // Unless a specific label is requested or showUnlabeledOnly is false
    if (showUnlabeledOnly && effectiveFilters.label === undefined) {
      effectiveFilters.labelIsNull = true;
    }

    const emails = await this.emailRepository.list({
      ...effectiveFilters,
      limit: pageSize,
      offset,
    });

    // Get total count (would need a separate count query for accuracy)
    const stats = await this.emailRepository.getStats();
    const total = stats.total;

    return {
      emails,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get unprocessed emails
   */
  async getUnprocessedEmails(limit: number = 100): Promise<EmailRecord[]> {
    return this.emailRepository.list({
      is_processed: false,
      processing_status: 'pending',
      limit,
    });
  }

  /**
   * Get failed emails
   */
  async getFailedEmails(limit: number = 100): Promise<EmailRecord[]> {
    return this.emailRepository.list({
      processing_status: 'failed',
      limit,
    });
  }

  /**
   * Get email attachments
   */
  async getEmailAttachments(emailId: number) {
    return this.emailRepository.getAttachments(emailId);
  }

  /**
   * Get single attachment
   */
  async getAttachment(attachmentId: number) {
    return this.emailRepository.getAttachment(attachmentId);
  }

  /**
   * Mark email as read (in database)
   */
  async markAsRead(emailId: number): Promise<EmailRecord | null> {
    return this.emailRepository.markAsRead(emailId);
  }

  /**
   * Mark email as read in IMAP
   */
  async markAsReadInImap(uid: string): Promise<void> {
    return this.imapService.markAsRead(uid);
  }

  /**
   * Update email processing status
   */
  async updateProcessingStatus(
    emailId: number,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped',
    error?: string
  ): Promise<EmailRecord | null> {
    return this.emailRepository.updateProcessingStatus(emailId, status, error);
  }

  /**
   * Link email to invoice
   */
  async linkToInvoice(emailId: number, invoiceId: number): Promise<EmailRecord | null> {
    return this.emailRepository.linkToInvoice(emailId, invoiceId);
  }

  /**
   * Delete email
   */
  async deleteEmail(emailId: number): Promise<boolean> {
    return this.emailRepository.delete(emailId);
  }

  /**
   * Get email statistics
   */
  async getStats(): Promise<EmailStats> {
    return this.emailRepository.getStats();
  }

  /**
   * Retry processing a failed email
   */
  async retryFailedEmail(emailId: number): Promise<EmailRecord | null> {
    const email = await this.emailRepository.findById(emailId);

    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    if (email.processing_status !== 'failed') {
      throw new Error(`Email ${emailId} is not in failed status`);
    }

    // Reset to pending for reprocessing
    return this.emailRepository.updateProcessingStatus(emailId, 'pending');
  }

  /**
   * Check if email exists
   */
  async emailExists(uid: string): Promise<boolean> {
    return this.emailRepository.existsByUid(uid);
  }

  /**
   * Update email label and process if needed
   */
  async updateEmailLabel(
    emailId: number,
    label: 'incoming_invoice' | 'receipt' | 'newsletter' | 'other' | null
  ): Promise<EmailRecord | null> {
    const updatedEmail = await this.emailRepository.updateLabel(emailId, label);

    if (!updatedEmail) {
      return null;
    }

    // Auto-process invoices and receipts
    if (label === 'incoming_invoice' || label === 'receipt') {
      try {
        console.log(`Processing email ${emailId} as ${label}...`);
        await this.processEmailAsInvoice(updatedEmail);

        // Mark as processed
        await this.emailRepository.updateProcessingStatus(emailId, 'completed');
      } catch (error) {
        console.error(`Failed to process email ${emailId} as invoice:`, error);
        await this.emailRepository.updateProcessingStatus(
          emailId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    } else if (label === 'newsletter' || label === 'other') {
      // Just mark as processed, no further action
      await this.emailRepository.updateProcessingStatus(emailId, 'skipped');
    }

    return updatedEmail;
  }

  /**
   * Process an email as an invoice - creates incoming_invoice record
   */
  private async processEmailAsInvoice(email: EmailRecord): Promise<void> {
    const { InvoiceIngestionApp } = await import('../apps/invoice-ingestion/InvoiceIngestionApp');

    // Get email attachments
    const attachments = await this.emailRepository.getAttachments(email.id);

    // Convert EmailRecord + attachments to IMAP Email format
    const imapEmail: ImapEmail = {
      id: email.email_uid,
      subject: email.subject || '',
      from: email.from_address,
      to: email.to_address || '',
      cc: email.cc_address,
      bcc: email.bcc_address,
      date: email.email_date,
      body: email.body_text || '',
      htmlBody: email.body_html,
      attachments: attachments.map(att => ({
        filename: att.filename,
        mimeType: att.mime_type,
        data: att.file_data,
        size: att.file_size,
      })),
      isRead: email.is_read,
    };

    const ingestionApp = new InvoiceIngestionApp(this.pool);

    // Use the processEmail method - need to make it public or refactor
    // @ts-ignore - accessing private method
    await ingestionApp.processEmail(imapEmail);

    await ingestionApp.shutdown();
  }

  /**
   * Manually link email to company
   */
  async linkEmailToCompany(emailId: number, companyId: number | null): Promise<EmailRecord | null> {
    return this.emailRepository.linkToCompany(emailId, companyId);
  }

  /**
   * Manually link email to contact
   */
  async linkEmailToContact(emailId: number, contactId: number | null): Promise<EmailRecord | null> {
    return this.emailRepository.linkToContact(emailId, contactId);
  }
}