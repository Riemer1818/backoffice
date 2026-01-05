import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { Project } from '../models/Project';

/**
 * Project repository
 */
export class ProjectRepository extends BaseRepository<Project> {
  constructor(pool: Pool) {
    super(pool, 'projects');
  }

  protected fromDatabaseRow(row: any): Project {
    return Project.fromDatabase(row);
  }

  /**
   * Find projects by client
   */
  async findByClient(clientId: number): Promise<Project[]> {
    return this.findAll('client_id = $1', [clientId]);
  }

  /**
   * Find active projects
   */
  async findActive(): Promise<Project[]> {
    return this.findAll('status = $1', ['active']);
  }

  /**
   * Find projects by status
   */
  async findByStatus(status: string): Promise<Project[]> {
    return this.findAll('status = $1', [status]);
  }

  /**
   * Find active projects for a client
   */
  async findActiveByClient(clientId: number): Promise<Project[]> {
    return this.findAll('client_id = $1 AND status = $2', [clientId, 'active']);
  }

  /**
   * Get project with client info
   */
  async findWithClient(projectId: number): Promise<any | null> {
    const query = `
      SELECT
        p.*,
        c.name as client_name,
        c.type as client_type,
        c.email as client_email
      FROM projects p
      LEFT JOIN companies c ON p.client_id = c.id
      WHERE p.id = $1
    `;
    const result = await this.query(query, [projectId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
}
