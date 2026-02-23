import { EmailRepository, CreateEmailData } from '../EmailRepository';
import { Pool } from 'pg';

// Mock pg Pool
const mockQuery = jest.fn();
const mockConnect = jest.fn();

jest.mock('pg', () => {
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockQuery,
      connect: mockConnect,
    })),
  };
});

describe('EmailRepository', () => {
  let repository: EmailRepository;
  let mockPool: any;

  beforeEach(() => {
    mockQuery.mockClear();
    mockConnect.mockClear();
    mockPool = new Pool();
    repository = new EmailRepository(mockPool);
  });

  describe('create', () => {
    it('should create a new email record', async () => {
      const emailData: CreateEmailData = {
        email_uid: 'test-uid-123',
        subject: 'Test Email',
        from_address: 'sender@example.com',
        to_address: 'recipient@example.com',
        cc_address: 'cc@example.com',
        bcc_address: 'bcc@example.com',
        email_date: new Date('2024-01-01'),
        body_text: 'Test body',
        is_read: false,
        has_attachments: true,
        attachment_count: 2,
      };

      const mockResult = {
        rows: [{
          id: 1,
          ...emailData,
          is_processed: false,
          processing_status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      };

      mockPool.query.mockResolvedValue(mockResult as any);

      const result = await repository.create(emailData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO emails'),
        expect.arrayContaining([
          emailData.email_uid,
          null, // message_id
          emailData.subject,
          emailData.from_address,
          emailData.to_address,
          emailData.cc_address,
          emailData.bcc_address,
          emailData.email_date,
          emailData.body_text,
          null, // body_html
          emailData.is_read,
          emailData.has_attachments,
          emailData.attachment_count,
        ])
      );

      expect(result).toEqual(mockResult.rows[0]);
    });

    it('should handle emails without CC/BCC', async () => {
      const emailData: CreateEmailData = {
        email_uid: 'test-uid-456',
        subject: 'Simple Email',
        from_address: 'sender@example.com',
        to_address: 'recipient@example.com',
        email_date: new Date('2024-01-01'),
      };

      const mockResult = {
        rows: [{
          id: 2,
          ...emailData,
          cc_address: null,
          bcc_address: null,
          is_read: false,
          is_processed: false,
          processing_status: 'pending',
          has_attachments: false,
          attachment_count: 0,
        }],
      };

      mockPool.query.mockResolvedValue(mockResult as any);

      const result = await repository.create(emailData);

      expect(result.cc_address).toBeNull();
      expect(result.bcc_address).toBeNull();
    });
  });

  describe('findByUid', () => {
    it('should find email by UID', async () => {
      const mockEmail = {
        id: 1,
        email_uid: 'test-uid-123',
        subject: 'Test Email',
        from_address: 'sender@example.com',
      };

      mockPool.query.mockResolvedValue({ rows: [mockEmail] } as any);

      const result = await repository.findByUid('test-uid-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM emails WHERE email_uid = $1',
        ['test-uid-123']
      );
      expect(result).toEqual(mockEmail);
    });

    it('should return null if email not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.findByUid('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should list emails with filters', async () => {
      const mockEmails = [
        { id: 1, subject: 'Email 1', is_processed: false },
        { id: 2, subject: 'Email 2', is_processed: false },
      ];

      mockPool.query.mockResolvedValue({ rows: mockEmails } as any);

      const result = await repository.list({
        is_processed: false,
        limit: 10,
        offset: 0,
      });

      expect(mockPool.query).toHaveBeenCalled();
      expect(result).toEqual(mockEmails);
    });

    it('should handle from_address filter with ILIKE', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await repository.list({
        from_address: 'test@example.com',
      });

      const callArgs = mockPool.query.mock.calls[0];
      expect(callArgs[0]).toContain('from_address ILIKE');
      expect(callArgs[1]).toContain('%test@example.com%');
    });

    it('should apply date range filters', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await repository.list({
        date_from: dateFrom,
        date_to: dateTo,
      });

      const callArgs = mockPool.query.mock.calls[0];
      expect(callArgs[0]).toContain('email_date >=');
      expect(callArgs[0]).toContain('email_date <=');
      expect(callArgs[1]).toContain(dateFrom);
      expect(callArgs[1]).toContain(dateTo);
    });
  });

  describe('updateProcessingStatus', () => {
    it('should update status to completed', async () => {
      const mockUpdated = {
        id: 1,
        processing_status: 'completed',
        is_processed: true,
        processed_at: expect.any(Date),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await repository.updateProcessingStatus(1, 'completed');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE emails'),
        ['completed', null, true, expect.any(Date), 1]
      );
      expect(result?.processing_status).toBe('completed');
      expect(result?.is_processed).toBe(true);
    });

    it('should update status to failed with error', async () => {
      const errorMsg = 'IMAP connection failed';
      const mockUpdated = {
        id: 1,
        processing_status: 'failed',
        processing_error: errorMsg,
        is_processed: false,
      };

      mockPool.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await repository.updateProcessingStatus(1, 'failed', errorMsg);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE emails'),
        ['failed', errorMsg, false, expect.any(Date), 1]
      );
      expect(result?.processing_status).toBe('failed');
      expect(result?.processing_error).toBe(errorMsg);
    });
  });

  describe('createAttachment', () => {
    it('should create email attachment', async () => {
      const attachmentData = {
        email_id: 1,
        filename: 'invoice.pdf',
        mime_type: 'application/pdf',
        file_size: 12345,
        file_data: Buffer.from('test data'),
      };

      const mockResult = {
        rows: [{ id: 1, ...attachmentData, created_at: new Date() }],
      };

      mockPool.query.mockResolvedValue(mockResult as any);

      const result = await repository.createAttachment(attachmentData);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_attachments'),
        [
          attachmentData.email_id,
          attachmentData.filename,
          attachmentData.mime_type,
          attachmentData.file_size,
          attachmentData.file_data,
          false, // is_inline
          null, // content_id
        ]
      );
      expect(result.filename).toBe('invoice.pdf');
    });
  });

  describe('getStats', () => {
    it('should return email statistics', async () => {
      const mockStats = {
        total: '100',
        unread: '20',
        processed: '80',
        pending: '15',
        failed: '5',
        with_attachments: '60',
      };

      mockPool.query.mockResolvedValue({ rows: [mockStats] } as any);

      const result = await repository.getStats();

      expect(result).toEqual({
        total: 100,
        unread: 20,
        processed: 80,
        pending: 15,
        failed: 5,
        with_attachments: 60,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark email as read', async () => {
      const mockUpdated = {
        id: 1,
        is_read: true,
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockUpdated] } as any);

      const result = await repository.markAsRead(1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE emails'),
        [1]
      );
      expect(result?.is_read).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete email successfully', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 } as any);

      const result = await repository.delete(1);

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM emails WHERE id = $1',
        [1]
      );
      expect(result).toBe(true);
    });

    it('should return false if email not found', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 } as any);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });

  describe('existsByUid', () => {
    it('should return true if email exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ exists: true }] } as any);

      const result = await repository.existsByUid('test-uid');

      expect(result).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.existsByUid('non-existent');

      expect(result).toBe(false);
    });
  });
});
