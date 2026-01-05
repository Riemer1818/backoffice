import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { ContactAssociation } from '../models/ContactAssociation';

/**
 * ContactAssociation repository
 */
export class ContactAssociationRepository extends BaseRepository<ContactAssociation> {
  constructor(pool: Pool) {
    super(pool, 'contact_associations');
  }

  protected fromDatabaseRow(row: any): ContactAssociation {
    return ContactAssociation.fromDatabase(row);
  }

  /**
   * Find associations by contact ID
   */
  async findByContactId(contactId: number): Promise<ContactAssociation[]> {
    return this.findAll('contact_id = $1', [contactId]);
  }

  /**
   * Find associations by company ID
   */
  async findByCompanyId(companyId: number): Promise<ContactAssociation[]> {
    return this.findAll('company_id = $1', [companyId]);
  }

  /**
   * Find associations by project ID
   */
  async findByProjectId(projectId: number): Promise<ContactAssociation[]> {
    return this.findAll('project_id = $1', [projectId]);
  }

  /**
   * Get primary contact for a company
   */
  async findPrimaryByCompanyId(companyId: number): Promise<ContactAssociation | null> {
    const result = await this.findAll('company_id = $1 AND is_primary = true AND is_active = true', [companyId]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get associations with full details (contact, company, project names)
   */
  async findWithDetails(contactId?: number, companyId?: number, projectId?: number): Promise<any[]> {
    let query = `
      SELECT
        ca.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        co.name as company_name,
        p.name as project_name
      FROM contact_associations ca
      JOIN contacts c ON ca.contact_id = c.id
      LEFT JOIN companies co ON ca.company_id = co.id
      LEFT JOIN projects p ON ca.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (contactId) {
      params.push(contactId);
      query += ` AND ca.contact_id = $${params.length}`;
    }

    if (companyId) {
      params.push(companyId);
      query += ` AND ca.company_id = $${params.length}`;
    }

    if (projectId) {
      params.push(projectId);
      query += ` AND ca.project_id = $${params.length}`;
    }

    query += ' ORDER BY ca.is_primary DESC, ca.created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Set a contact as primary for a company (and unset others)
   */
  async setPrimaryForCompany(contactId: number, companyId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Unset all other primary contacts for this company
      await client.query(
        'UPDATE contact_associations SET is_primary = false WHERE company_id = $1',
        [companyId]
      );

      // Set this contact as primary
      await client.query(
        'UPDATE contact_associations SET is_primary = true WHERE contact_id = $1 AND company_id = $2',
        [contactId, companyId]
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