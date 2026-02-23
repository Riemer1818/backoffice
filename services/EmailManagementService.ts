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

      await client.query('COMMIT');
      return emailRecord;
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
    pageSize: number = 50
  ): Promise<EmailListResult> {
    const offset = (page - 1) * pageSize;

    const emails = await this.emailRepository.list({
      ...filters,
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
}