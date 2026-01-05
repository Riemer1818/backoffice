import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

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
  attachments: EmailAttachment[];
}

export interface EmailFilter {
  from?: string;
  subject?: string;
  hasAttachment?: boolean;
  unreadOnly?: boolean;
  since?: Date;
}

/**
 * Email service supporting Gmail API
 * Handles authentication, fetching, and parsing emails
 */
export class EmailService {
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    if (process.env.GMAIL_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      });
    }

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    });
  }

  /**
   * Set credentials from OAuth code
   */
  async setCredentials(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens.refresh_token;
  }

  /**
   * Fetch emails matching filter criteria
   */
  async fetchEmails(filter: EmailFilter = {}): Promise<Email[]> {
    const query = this.buildQuery(filter);

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    if (!response.data.messages) {
      return [];
    }

    const emails = await Promise.all(
      response.data.messages.map((msg: any) => this.fetchEmail(msg.id))
    );

    return emails.filter((e): e is Email => e !== null);
  }

  /**
   * Fetch a single email by ID
   */
  private async fetchEmail(messageId: string): Promise<Email | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload.headers;

      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const attachments = await this.extractAttachments(message);

      return {
        id: message.id,
        subject: getHeader('subject'),
        from: getHeader('from'),
        to: getHeader('to'),
        date: new Date(parseInt(message.internalDate)),
        body: this.extractBody(message.payload),
        attachments,
      };
    } catch (error) {
      console.error(`Failed to fetch email ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Extract email body from payload
   */
  private extractBody(payload: any): string {
    if (payload.body.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      }
    }

    return '';
  }

  /**
   * Extract attachments from email
   */
  private async extractAttachments(message: any): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    if (!message.payload.parts) return attachments;

    for (const part of message.payload.parts) {
      if (part.filename && part.body.attachmentId) {
        const attachment = await this.gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: message.id,
          id: part.body.attachmentId,
        });

        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType,
          data: Buffer.from(attachment.data.data, 'base64'),
          size: part.body.size,
        });
      }
    }

    return attachments;
  }

  /**
   * Build Gmail search query from filter
   */
  private buildQuery(filter: EmailFilter): string {
    const parts: string[] = [];

    if (filter.from) parts.push(`from:${filter.from}`);
    if (filter.subject) parts.push(`subject:${filter.subject}`);
    if (filter.hasAttachment) parts.push('has:attachment');
    if (filter.unreadOnly) parts.push('is:unread');
    if (filter.since) {
      const date = filter.since.toISOString().split('T')[0];
      parts.push(`after:${date}`);
    }

    return parts.join(' ');
  }

  /**
   * Mark email as read
   */
  async markAsRead(emailId: string) {
    await this.gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
  }
}