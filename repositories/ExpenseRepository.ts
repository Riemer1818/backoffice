import { Pool } from 'pg';

export class ExpenseRepository {
  constructor(private pool: Pool) {}

  async findById(id: number): Promise<any | null> {
    const result = await this.pool.query(
      `SELECT e.id, e.date, e.supplier_name, e.category_name, e.description,
              e.amount, e.vat_amount, e.is_deductible, e.notes,
              e.receipt_file, e.receipt_filename, e.created_at, e.updated_at,
              e.contact_id, e.project_id, e.category_id, e.tax_rate_id,
              tr.name as tax_rate_name, tr.rate as tax_rate
       FROM expenses e
       LEFT JOIN tax_rates tr ON e.tax_rate_id = tr.id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async findAll(limit = 100): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT e.id, e.date, e.supplier_name, e.category_name, e.description,
              e.amount, e.vat_amount, e.is_deductible, e.notes,
              e.receipt_filename, e.created_at, e.updated_at,
              e.contact_id, e.project_id, e.category_id, e.tax_rate_id,
              tr.name as tax_rate_name, tr.rate as tax_rate,
              CASE WHEN e.receipt_file IS NOT NULL THEN true ELSE false END as has_receipt
       FROM expenses e
       LEFT JOIN tax_rates tr ON e.tax_rate_id = tr.id
       ORDER BY e.date DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  async findByProject(projectId: number): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT e.id, e.date, e.supplier_name, e.category_name, e.description,
              e.amount, e.vat_amount, e.is_deductible, e.notes,
              e.receipt_filename, e.created_at, e.updated_at,
              e.contact_id, e.project_id, e.category_id, e.tax_rate_id,
              tr.name as tax_rate_name, tr.rate as tax_rate,
              CASE WHEN e.receipt_file IS NOT NULL THEN true ELSE false END as has_receipt
       FROM expenses e
       LEFT JOIN tax_rates tr ON e.tax_rate_id = tr.id
       WHERE e.project_id = $1
       ORDER BY e.date DESC`,
      [projectId]
    );

    return result.rows;
  }

  async create(data: Partial<any>): Promise<any> {
    const result = await this.pool.query(
      `INSERT INTO incoming_invoices (supplier_id, project_id, category_id, tax_rate_id,
                                     invoice_date, description, subtotal, tax_amount, total_amount,
                                     invoice_file, invoice_file_name, notes, supplier_name,
                                     review_status, payment_status, source,
                                     source_email_id, source_email_subject, source_email_from, source_email_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        data.contact_id || data.supplier_id || null,
        data.project_id || null,
        data.category_id || null,
        data.tax_rate_id || null,
        data.date || data.invoice_date,
        data.description,
        data.amount - (data.vat_amount || 0), // subtotal = amount - vat
        data.vat_amount || data.tax_amount || 0,
        data.amount || data.total_amount,
        data.receipt_file || data.invoice_file || null,
        data.receipt_filename || data.invoice_file_name || null,
        data.notes || null,
        data.supplier_name || null,
        'pending', // review_status
        'unpaid', // payment_status
        'email', // source
        data.source_email_id || null,
        data.source_email_subject || null,
        data.source_email_from || null,
        data.source_email_date || null,
      ]
    );

    return result.rows[0];
  }

  async update(id: number, data: Partial<any>): Promise<any | null> {
    const result = await this.pool.query(
      `UPDATE expenses
       SET contact_id = $1, project_id = $2, category_id = $3, tax_rate_id = $4,
           date = $5, description = $6, amount = $7, vat_amount = $8,
           is_deductible = $9, notes = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        data.contact_id || null,
        data.project_id || null,
        data.category_id || null,
        data.tax_rate_id || null,
        data.date,
        data.description,
        data.amount,
        data.vat_amount || 0,
        data.is_deductible !== undefined ? data.is_deductible : true,
        data.notes || null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM expenses WHERE id = $1',
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  async getReceipt(id: number): Promise<{ file: Buffer; filename: string } | null> {
    const result = await this.pool.query(
      'SELECT receipt_file, receipt_filename FROM expenses WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].receipt_file) {
      return null;
    }

    return {
      file: result.rows[0].receipt_file,
      filename: result.rows[0].receipt_filename || 'receipt.pdf',
    };
  }
}
