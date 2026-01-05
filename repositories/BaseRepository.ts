import { Pool, PoolClient, QueryResult } from 'pg';
import { BaseEntity } from '../models/BaseEntity';

/**
 * Abstract base repository class
 * Provides common database operations
 */
export abstract class BaseRepository<T extends BaseEntity<any>> {
  protected pool: Pool;
  protected tableName: string;

  constructor(pool: Pool, tableName: string) {
    this.pool = pool;
    this.tableName = tableName;
  }

  /**
   * Find by ID
   */
  async findById(id: number): Promise<T | null> {
    const result = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.fromDatabaseRow(result.rows[0]);
  }

  /**
   * Find all with optional conditions
   */
  async findAll(where?: string, params?: any[]): Promise<T[]> {
    let query = `SELECT * FROM ${this.tableName}`;
    if (where) {
      query += ` WHERE ${where}`;
    }
    query += ` ORDER BY id DESC`;

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.fromDatabaseRow(row));
  }

  /**
   * Create new record
   */
  async create(entity: T): Promise<T> {
    const row = entity.toDatabaseRow();
    const columns = Object.keys(row);
    const values = Object.values(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    return this.fromDatabaseRow(result.rows[0]);
  }

  /**
   * Update existing record
   */
  async update(id: number, entity: T): Promise<T | null> {
    const row = entity.toDatabaseRow();
    const columns = Object.keys(row);
    const values = Object.values(row);
    const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${columns.length + 1}
      RETURNING *
    `;

    const result = await this.pool.query(query, [...values, id]);
    if (result.rows.length === 0) return null;
    return this.fromDatabaseRow(result.rows[0]);
  }

  /**
   * Delete record
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Count records
   */
  async count(where?: string, params?: any[]): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    if (where) {
      query += ` WHERE ${where}`;
    }

    const result = await this.pool.query(query, params);
    return parseInt(result.rows[0].count);
  }

  /**
   * Execute custom query
   */
  protected async query(query: string, params?: any[]): Promise<QueryResult> {
    return this.pool.query(query, params);
  }

  /**
   * Convert database row to entity instance
   * Must be implemented by subclass
   */
  protected abstract fromDatabaseRow(row: any): T;
}
