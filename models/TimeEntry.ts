import { BaseEntity } from './BaseEntity';
import { TimeEntrySchema, TimeEntryType } from './schemas/TimeEntry';

/**
 * TimeEntry entity
 */
export class TimeEntry extends BaseEntity<TimeEntryType> {
  constructor(data: TimeEntryType) {
    const validated = TimeEntrySchema.parse(data);
    super(validated);
  }

  // Getters
  get projectId(): number {
    return this.data.project_id;
  }

  get contactId(): number | undefined {
    return this.data.contact_id;
  }

  get date(): Date {
    return this.data.date;
  }

  get startTime(): Date | undefined {
    return this.data.start_time;
  }

  get endTime(): Date | undefined {
    return this.data.end_time;
  }

  get totalHours(): number {
    return this.data.total_hours;
  }

  get chargeableHours(): number {
    return this.data.chargeable_hours;
  }

  get location(): string | undefined {
    return this.data.location;
  }

  get objective(): string | undefined {
    return this.data.objective;
  }

  get notes(): string | undefined {
    return this.data.notes;
  }

  get isWbso(): boolean {
    return this.data.is_wbso;
  }

  get isInvoiced(): boolean {
    return this.data.is_invoiced;
  }

  get invoiceId(): number | undefined {
    return this.data.invoice_id;
  }

  // Status checkers
  isChargeable(): boolean {
    return this.data.chargeable_hours > 0;
  }

  hasStartAndEndTime(): boolean {
    return !!this.data.start_time && !!this.data.end_time;
  }

  // Helpers
  getFormattedDate(): string {
    return this.data.date.toISOString().split('T')[0];
  }

  getFormattedHours(): string {
    return `${this.data.total_hours.toFixed(2)}h (${this.data.chargeable_hours.toFixed(2)}h billable)`;
  }

  // Database mapping
  toDatabaseRow(): Record<string, any> {
    return {
      project_id: this.data.project_id,
      contact_id: this.data.contact_id,
      date: this.data.date,
      start_time: this.data.start_time,
      end_time: this.data.end_time,
      total_hours: this.data.total_hours,
      chargeable_hours: this.data.chargeable_hours,
      location: this.data.location,
      objective: this.data.objective,
      notes: this.data.notes,
      is_wbso: this.data.is_wbso,
      is_invoiced: this.data.is_invoiced,
      invoice_id: this.data.invoice_id,
    };
  }

  static fromDatabase(row: any): TimeEntry {
    return new TimeEntry({
      id: row.id,
      project_id: row.project_id,
      contact_id: row.contact_id || undefined,
      date: new Date(row.date),
      start_time: row.start_time ? new Date(row.start_time) : undefined,
      end_time: row.end_time ? new Date(row.end_time) : undefined,
      total_hours: parseFloat(row.total_hours),
      chargeable_hours: parseFloat(row.chargeable_hours),
      location: row.location || undefined,
      objective: row.objective || undefined,
      notes: row.notes || undefined,
      is_wbso: row.is_wbso || false,
      is_invoiced: row.is_invoiced || false,
      invoice_id: row.invoice_id || undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}