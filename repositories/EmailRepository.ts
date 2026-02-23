import { Pool, PoolClient } from 'pg';

export interface EmailRecord {
  id: number;
  email_uid: string;
  message_id?: string;
  subject?: string;
  from_address: string;
  to_address?: string;
  cc_address?: string;
  bcc_address?: string;
  email_date: Date;
  body_text?: string;
  body_html?: string;
  is_read: boolean;
  is_processed: boolean;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  processing_error?: string;
  processed_at?: Date;
  linked_invoice_id?: number;
  has_attachments: boolean;
  attachment_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface EmailAttachmentRecord {
  id: number;
  email_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  file_data: Buffer;
  is_inline: boolean;
  content_id?: string;
  created_at: Date;
}

export interface CreateEmailData {
  email_uid: string;
  message_id?: string;
  subject?: string;
  from_address: string;
  to_address?: string;
  cc_address?: string;
  bcc_address?: string;
  email_date: Date;
  body_text?: string;
  body_html?: string;
  is_read?: boolean;
  has_attachments?: boolean;
  attachment_count?: number;
}

export interface CreateAttachmentData {
  email_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  file_data: Buffer;
  is_inline?: boolean;
  content_id?: string;
}

export interface EmailFilters {
  is_read?: boolean;
  is_processed?: boolean;
  processing_status?: string;
  has_attachments?: boolean;
  from_address?: string;
  date_from?: Date;
  date_to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Repository for managing emails in the database
 */
export class EmailRepository {
  constructor(private pool: Pool) {}

  /**
   * Create a new email record
   */
  async create(data: CreateEmailData, client?: PoolClient): Promise<EmailRecord> {
    const db = client || this.pool;

    const result = await db.query(
      `INSERT INTO emails (
        email_uid, message_id, subject, from_address, to_address, cc_address, bcc_address,
        email_date, body_text, body_html, is_read, has_attachments, attachment_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.email_uid,
        data.message_id || null,
        data.subject || null,
        data.from_address,
        data.to_address || null,
        data.cc_address || null,
        data.bcc_address || null,
        data.email_date,
        data.body_text || null,
        data.body_html || null,
        data.is_read || false,
        data.has_attachments || false,
        data.attachment_count || 0,
      ]
    );

    return result.rows[0];
  }

  /**
   * Create email attachment
   */
  async createAttachment(data: CreateAttachmentData, client?: PoolClient): Promise<EmailAttachmentRecord> {
    const db = client || this.pool;

    const result = await db.query(
      `INSERT INTO email_attachments (
        email_id, filename, mime_type, file_size, file_data, is_inline, content_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.email_id,
        data.filename,
        data.mime_type,
        data.file_size,
        data.file_data,
        data.is_inline || false,
        data.content_id || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Find email by UID
   */
  async findByUid(uid: string): Promise<EmailRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM emails WHERE email_uid = $1',
      [uid]
    );

    return result.rows[0] || null;
  }

  /**
   * Find email by ID
   */
  async findById(id: number): Promise<EmailRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM emails WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * List emails with filters
   */
  async list(filters: EmailFilters = {}): Promise<EmailRecord[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.is_read !== undefined) {
      conditions.push(`is_read = $${paramIndex++}`);
      params.push(filters.is_read);
    }

    if (filters.is_processed !== undefined) {
      conditions.push(`is_processed = $${paramIndex++}`);
      params.push(filters.is_processed);
    }

    if (filters.processing_status) {
      conditions.push(`processing_status = $${paramIndex++}`);
      params.push(filters.processing_status);
    }

    if (filters.has_attachments !== undefined) {
      conditions.push(`has_attachments = $${paramIndex++}`);
      params.push(filters.has_attachments);
    }

    if (filters.from_address) {
      conditions.push(`from_address ILIKE $${paramIndex++}`);
      params.push(`%${filters.from_address}%`);
    }

    if (filters.date_from) {
      conditions.push(`email_date >= $${paramIndex++}`);
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push(`email_date <= $${paramIndex++}`);
      params.push(filters.date_to);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const result = await this.pool.query(
      `SELECT * FROM emails
       ${whereClause}
       ORDER BY email_date DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get email attachments
   */
  async getAttachments(emailId: number): Promise<EmailAttachmentRecord[]> {
    const result = await this.pool.query(
      'SELECT * FROM email_attachments WHERE email_id = $1 ORDER BY id',
      [emailId]
    );

    return result.rows;
  }

  /**
   * Get single attachment
   */
  async getAttachment(attachmentId: number): Promise<EmailAttachmentRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM email_attachments WHERE id = $1',
      [attachmentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Update email processing status
   */
  async updateProcessingStatus(
    id: number,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped',
    error?: string
  ): Promise<EmailRecord | null> {
    const result = await this.pool.query(
      `UPDATE emails
       SET processing_status = $1,
           processing_error = $2,
           is_processed = $3,
           processed_at = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        status,
        error || null,
        status === 'completed',
        status === 'completed' || status === 'failed' ? new Date() : null,
        id,
      ]
    );

    return result.rows[0] || null;
  }

  /**
   * Mark email as read
   */
  async markAsRead(id: number): Promise<EmailRecord | null> {
    const result = await this.pool.query(
      `UPDATE emails
       SET is_read = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Link email to invoice
   */
  async linkToInvoice(emailId: number, invoiceId: number): Promise<EmailRecord | null> {
    const result = await this.pool.query(
      `UPDATE emails
       SET linked_invoice_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [invoiceId, emailId]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete email
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM emails WHERE id = $1',
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Get email statistics
   */
  async getStats(): Promise<{
    total: number;
    unread: number;
    processed: number;
    pending: number;
    failed: number;
    with_attachments: number;
  }> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_read = false) as unread,
        COUNT(*) FILTER (WHERE is_processed = true) as processed,
        COUNT(*) FILTER (WHERE processing_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
        COUNT(*) FILTER (WHERE has_attachments = true) as with_attachments
      FROM emails
    `);

    const row = result.rows[0];
    return {
      total: parseInt(row.total) || 0,
      unread: parseInt(row.unread) || 0,
      processed: parseInt(row.processed) || 0,
      pending: parseInt(row.pending) || 0,
      failed: parseInt(row.failed) || 0,
      with_attachments: parseInt(row.with_attachments) || 0,
    };
  }

  /**
   * Check if email exists by UID
   */
  async existsByUid(uid: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM emails WHERE email_uid = $1 LIMIT 1',
      [uid]
    );

    return result.rows.length > 0;
  }
}