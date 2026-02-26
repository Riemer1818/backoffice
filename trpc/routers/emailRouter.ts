import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { EmailManagementService } from '../../services/EmailManagementService';
import { Pool } from 'pg';

// Get DB pool from environment
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '54322'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Create email service instance
const emailService = new EmailManagementService(pool, {
  user: process.env.IMAP_USER || '',
  password: process.env.IMAP_PASSWORD || '',
  host: process.env.IMAP_HOST || '',
  port: parseInt(process.env.IMAP_PORT || '993'),
  tls: true,
});

export const emailRouter = router({
  /**
   * Fetch unread emails from IMAP
   * Saves them to database and marks as read in IMAP
   */
  fetchUnread: publicProcedure.mutation(async () => {
    try {
      const emails = await emailService.fetchAndSaveUnreadEmails();
      return {
        success: true,
        count: emails.length,
        emails,
      };
    } catch (error) {
      console.error('Error fetching unread emails:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        count: 0,
        emails: [],
      };
    }
  }),

  /**
   * List emails from database with filters and pagination
   * By default, only shows unlabeled emails (for dashboard inbox)
   */
  list: publicProcedure
    .input(
      z.object({
        is_read: z.boolean().optional(),
        label: z.enum(['incoming_invoice', 'receipt', 'newsletter', 'other']).nullable().optional(),
        has_attachments: z.boolean().optional(),
        from_address: z.string().optional(),
        showUnlabeledOnly: z.boolean().optional().default(true),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const { page, pageSize, showUnlabeledOnly, ...filters } = input;
      return emailService.listEmails(filters, page, pageSize, showUnlabeledOnly);
    }),

  /**
   * Get single email by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const email = await emailService.getEmailById(input.id);
      if (!email) {
        throw new Error('Email not found');
      }

      const attachments = await emailService.getEmailAttachments(input.id);

      return {
        ...email,
        attachments,
      };
    }),

  /**
   * Update email label
   */
  updateLabel: publicProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.enum(['incoming_invoice', 'receipt', 'newsletter', 'other']).nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const updatedEmail = await emailService.updateEmailLabel(input.id, input.label);
      if (!updatedEmail) {
        throw new Error('Email not found');
      }
      return updatedEmail;
    }),

  /**
   * Mark email as read (in database)
   */
  markAsRead: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const updatedEmail = await emailService.markAsRead(input.id);
      if (!updatedEmail) {
        throw new Error('Email not found');
      }
      return updatedEmail;
    }),

  /**
   * Get email statistics
   */
  getStats: publicProcedure.query(async () => {
    return emailService.getStats();
  }),

  /**
   * Delete email
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const deleted = await emailService.deleteEmail(input.id);
      if (!deleted) {
        throw new Error('Email not found or could not be deleted');
      }
      return { success: true };
    }),

  /**
   * Get emails by company
   */
  getByCompany: publicProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const emails = await emailService.listEmails(
        { linked_company_id: input.companyId },
        1,
        100,
        false
      );
      return emails.emails;
    }),

  /**
   * Get emails by contact
   */
  getByContact: publicProcedure
    .input(z.object({ contactId: z.number() }))
    .query(async ({ input }) => {
      const emails = await emailService.listEmails(
        { linked_contact_id: input.contactId },
        1,
        100,
        false
      );
      return emails.emails;
    }),

  /**
   * Manually link email to company
   */
  linkToCompany: publicProcedure
    .input(z.object({ emailId: z.number(), companyId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const updated = await emailService.linkEmailToCompany(input.emailId, input.companyId);
      if (!updated) {
        throw new Error('Email not found');
      }
      return updated;
    }),

  /**
   * Manually link email to contact
   */
  linkToContact: publicProcedure
    .input(z.object({ emailId: z.number(), contactId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const updated = await emailService.linkEmailToContact(input.emailId, input.contactId);
      if (!updated) {
        throw new Error('Email not found');
      }
      return updated;
    }),
});
