import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { TimeEntry } from '../models/TimeEntry';

/**
 * TimeEntry repository
 */
export class TimeEntryRepository extends BaseRepository<TimeEntry> {
  constructor(pool: Pool) {
    super(pool, 'time_entries');
  }

  protected fromDatabaseRow(row: any): TimeEntry {
    return TimeEntry.fromDatabase(row);
  }

  /**
   * Find time entries by project
   */
  async findByProject(projectId: number): Promise<TimeEntry[]> {
    return this.findAll('project_id = $1', [projectId]);
  }

  /**
   * Find time entries by date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<TimeEntry[]> {
    return this.findAll('date >= $1 AND date <= $2 ORDER BY date DESC', [startDate, endDate]);
  }

  /**
   * Find uninvoiced time entries
   */
  async findUninvoiced(): Promise<TimeEntry[]> {
    return this.findAll('is_invoiced = false', []);
  }

  /**
   * Find uninvoiced time entries by project
   */
  async findUninvoicedByProject(projectId: number): Promise<TimeEntry[]> {
    return this.findAll('project_id = $1 AND is_invoiced = false', [projectId]);
  }

  /**
   * Find time entries by invoice
   */
  async findByInvoice(invoiceId: number): Promise<TimeEntry[]> {
    return this.findAll('invoice_id = $1', [invoiceId]);
  }

  /**
   * Get time entries with project info
   */
  async findWithProject(id: number): Promise<any | null> {
    const query = `
      SELECT
        te.*,
        p.name as project_name,
        p.client_id,
        c.name as client_name
      FROM time_entries te
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN companies c ON p.client_id = c.id
      WHERE te.id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get all time entries with project info for a date range
   */
  async findAllWithProjectInfo(startDate?: Date, endDate?: Date): Promise<any[]> {
    let query = `
      SELECT
        te.*,
        p.name as project_name,
        p.color as project_color,
        p.client_id,
        c.name as client_name
      FROM time_entries te
      LEFT JOIN projects p ON te.project_id = p.id
      LEFT JOIN companies c ON p.client_id = c.id
    `;

    const params: any[] = [];
    if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` WHERE te.date >= $1 AND te.date <= $2`;
    }

    query += ' ORDER BY te.date DESC, te.created_at DESC';

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Mark time entries as invoiced
   */
  async markAsInvoiced(timeEntryIds: number[], invoiceId: number): Promise<void> {
    const query = `
      UPDATE time_entries
      SET is_invoiced = true, invoice_id = $1, updated_at = NOW()
      WHERE id = ANY($2)
    `;
    await this.query(query, [invoiceId, timeEntryIds]);
  }

  /**
   * Get total hours by project for a date range
   */
  async getTotalHoursByProject(projectId: number, startDate?: Date, endDate?: Date): Promise<{ total_hours: number, chargeable_hours: number }> {
    let query = `
      SELECT
        COALESCE(SUM(total_hours), 0) as total_hours,
        COALESCE(SUM(chargeable_hours), 0) as chargeable_hours
      FROM time_entries
      WHERE project_id = $1
    `;

    const params: any[] = [projectId];
    if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND date >= $2 AND date <= $3`;
    }

    const result = await this.query(query, params);
    return {
      total_hours: parseFloat(result.rows[0].total_hours) || 0,
      chargeable_hours: parseFloat(result.rows[0].chargeable_hours) || 0,
    };
  }
}