import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { Contact } from '../models/Contact';

/**
 * Contact repository
 */
export class ContactRepository extends BaseRepository<Contact> {
  constructor(pool: Pool) {
    super(pool, 'contacts');
  }

  protected fromDatabaseRow(row: any): Contact {
    return Contact.fromDatabase(row);
  }

  /**
   * Find contacts by company ID
   */
  async findByCompanyId(companyId: number): Promise<Contact[]> {
    return this.findAll('company_id = $1', [companyId]);
  }

  /**
   * Find active contacts by company ID
   */
  async findActiveByCompanyId(companyId: number): Promise<Contact[]> {
    return this.findAll('company_id = $1 AND is_active = true', [companyId]);
  }

  /**
   * Find primary contact for a company
   */
  async findPrimaryContactByCompanyId(companyId: number): Promise<Contact | null> {
    const result = await this.findAll('company_id = $1 AND is_primary = true AND is_active = true', [companyId]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Find contact by email
   */
  async findByEmail(email: string): Promise<Contact[]> {
    return this.findAll('LOWER(email) = LOWER($1)', [email]);
  }

  /**
   * Search contacts by name
   */
  async searchByName(search: string): Promise<Contact[]> {
    return this.findAll(
      "CONCAT(first_name, ' ', last_name) ILIKE $1",
      [`%${search}%`]
    );
  }

  /**
   * Find all active contacts
   */
  async findActive(): Promise<Contact[]> {
    return this.findAll('is_active = true');
  }

  /**
   * Get contacts with company info (including those without companies)
   */
  async findAllWithCompany(): Promise<any[]> {
    const result = await this.pool.query(`
      SELECT
        c.*,
        co.name as company_name,
        co.type as company_type
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      ORDER BY c.created_at DESC
    `);
    return result.rows;
  }

  /**
   * Set a contact as primary (and unset others for that company)
   */
  async setPrimary(contactId: number): Promise<boolean> {
    const contact = await this.findById(contactId);
    if (!contact) {
      return false;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Unset all other primary contacts for this company
      await client.query(
        'UPDATE contacts SET is_primary = false WHERE company_id = $1',
        [contact.companyId]
      );

      // Set this contact as primary
      await client.query(
        'UPDATE contacts SET is_primary = true WHERE id = $1',
        [contactId]
      );

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}