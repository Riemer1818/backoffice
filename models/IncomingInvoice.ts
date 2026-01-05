import { BaseEntity } from './BaseEntity';
import { IncomingInvoiceSchema, IncomingInvoiceType } from './schemas/IncomingInvoice';

/**
 * IncomingInvoice entity - expenses/supplier invoices
 * Used for the invoice review workflow
 */
export class IncomingInvoice extends BaseEntity<IncomingInvoiceType> {
  constructor(data: IncomingInvoiceType) {
    const validated = IncomingInvoiceSchema.parse(data);
    super(validated);
  }

  // Getters
  get supplierId(): number | null | undefined {
    return this.data.supplier_id;
  }

  get projectId(): number | null | undefined {
    return this.data.project_id;
  }

  get invoiceNumber(): string | null | undefined {
    return this.data.invoice_number;
  }

  get invoiceDate(): Date | null | undefined {
    return this.data.invoice_date;
  }

  get dueDate(): Date | null | undefined {
    return this.data.due_date;
  }

  get reviewStatus(): 'pending' | 'approved' | 'rejected' {
    return this.data.review_status;
  }

  get paymentStatus(): 'unpaid' | 'paid' {
    return this.data.payment_status;
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

  get supplierName(): string | null | undefined {
    return this.data.supplier_name;
  }

  get description(): string | null | undefined {
    return this.data.description;
  }

  get categoryId(): number | null | undefined {
    return this.data.category_id;
  }

  get invoiceFile(): Buffer | null | undefined {
    return this.data.invoice_file;
  }

  get invoiceFilename(): string | null | undefined {
    return this.data.invoice_filename;
  }

  // Helper methods
  isPending(): boolean {
    return this.reviewStatus === 'pending';
  }

  isApproved(): boolean {
    return this.reviewStatus === 'approved';
  }

  isPaid(): boolean {
    return this.paymentStatus === 'paid';
  }

  /**
   * Create from database row
   */
  static fromDatabase(row: any): IncomingInvoice {
    return new IncomingInvoice({
      id: row.id,
      supplier_id: row.supplier_id,
      project_id: row.project_id,
      invoice_number: row.invoice_number,
      invoice_date: row.invoice_date ? new Date(row.invoice_date) : null,
      due_date: row.due_date ? new Date(row.due_date) : null,
      review_status: row.review_status,
      reviewed_at: row.reviewed_at ? new Date(row.reviewed_at) : null,
      rejection_reason: row.rejection_reason,
      payment_status: row.payment_status,
      paid_date: row.paid_date ? new Date(row.paid_date) : null,
      subtotal: parseFloat(row.subtotal) || 0,
      tax_amount: parseFloat(row.tax_amount) || 0,
      total_amount: parseFloat(row.total_amount) || 0,
      currency: row.currency || 'EUR',
      tax_rate_id: row.tax_rate_id,
      category_id: row.category_id,
      supplier_name: row.supplier_name,
      description: row.description,
      invoice_file: row.invoice_file,
      invoice_filename: row.invoice_filename,
      extraction_confidence: row.extraction_confidence,
      llm_raw_response: row.llm_raw_response,
      notes: row.notes,
      original_currency: row.original_currency || 'EUR',
      original_amount: row.original_amount ? parseFloat(row.original_amount) : undefined,
      exchange_rate: row.exchange_rate ? parseFloat(row.exchange_rate) : 1.0,
      exchange_rate_date: row.exchange_rate_date ? new Date(row.exchange_rate_date) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}
