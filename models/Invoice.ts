import { BaseEntity } from './BaseEntity';
import { InvoiceSchema, InvoiceType, InvoiceStatus } from './schemas/Invoice';

/**
 * Invoice entity - outgoing invoices to clients
 */
export class Invoice extends BaseEntity<InvoiceType> {
  constructor(data: Partial<InvoiceType>) {
    // Convert string dates to Date objects if needed
    const processedData = {
      ...data,
      invoice_date: data.invoice_date instanceof Date ? data.invoice_date : new Date(data.invoice_date!),
      due_date: data.due_date instanceof Date ? data.due_date : new Date(data.due_date!),
      paid_date: data.paid_date ? (data.paid_date instanceof Date ? data.paid_date : new Date(data.paid_date)) : undefined,
      created_at: data.created_at ? (data.created_at instanceof Date ? data.created_at : new Date(data.created_at)) : undefined,
      updated_at: data.updated_at ? (data.updated_at instanceof Date ? data.updated_at : new Date(data.updated_at)) : undefined,
    };
    const validated = InvoiceSchema.parse(processedData);
    super(validated);
  }

  // Getters
  get clientId(): number {
    return this.data.client_id;
  }

  get projectId(): number | undefined {
    return this.data.project_id;
  }

  get invoiceNumber(): string {
    return this.data.invoice_number;
  }

  get invoiceDate(): Date {
    return this.data.invoice_date;
  }

  get dueDate(): Date {
    return this.data.due_date;
  }

  get status(): InvoiceStatus {
    return this.data.status;
  }

  get subtotal(): number {
    return this.data.subtotal;
  }

  get taxAmount(): number {
    return this.data.tax_amount;
  }

  get totalAmount(): number {
    return this.data.total_amount;
  }

  get currency(): string {
    return this.data.currency;
  }

  get paymentTermsDays(): number {
    return this.data.payment_terms_days;
  }

  get paidDate(): Date | undefined {
    return this.data.paid_date;
  }

  get pdfFile(): Buffer | undefined {
    return this.data.pdf_file;
  }

  get notes(): string | undefined {
    return this.data.notes;
  }

  // Helper methods
  isPaid(): boolean {
    return this.status === 'paid';
  }

  isOverdue(): boolean {
    if (this.isPaid()) return false;
    return new Date() > this.dueDate;
  }

  /**
   * Create from database row
   */
  static fromDatabase(row: any): Invoice {
    return new Invoice({
      id: row.id,
      client_id: row.client_id,
      project_id: row.project_id,
      invoice_number: row.invoice_number,
      invoice_date: new Date(row.invoice_date),
      due_date: new Date(row.due_date),
      status: row.status,
      subtotal: parseFloat(row.subtotal),
      tax_amount: parseFloat(row.tax_amount),
      total_amount: parseFloat(row.total_amount),
      currency: row.currency,
      payment_terms_days: row.payment_terms_days,
      paid_date: row.paid_date ? new Date(row.paid_date) : undefined,
      pdf_file: row.pdf_file,
      notes: row.notes,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}
