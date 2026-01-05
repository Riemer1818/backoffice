import { BaseEntity } from './BaseEntity';
import { ProjectSchema, ProjectType, ProjectStatus } from './schemas/Project';

/**
 * Project entity
 */
export class Project extends BaseEntity<ProjectType> {
  constructor(data: ProjectType) {
    const validated = ProjectSchema.parse(data);
    super(validated);
  }

  // Getters
  get name(): string {
    return this.data.name;
  }

  get clientId(): number {
    return this.data.client_id;
  }

  get status(): ProjectStatus {
    return this.data.status;
  }

  get hourlyRate(): number | undefined {
    return this.data.hourly_rate;
  }

  get currency(): string {
    return this.data.currency;
  }

  // Status checkers
  isActive(): boolean {
    return this.data.status === 'active';
  }

  isCompleted(): boolean {
    return this.data.status === 'completed';
  }

  isOnHold(): boolean {
    return this.data.status === 'on_hold';
  }

  isCancelled(): boolean {
    return this.data.status === 'cancelled';
  }

  isArchived(): boolean {
    return this.data.status === 'archived';
  }

  // Date helpers
  hasStarted(): boolean {
    if (!this.data.start_date) return true;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = new Date(this.data.start_date);
    start.setHours(0, 0, 0, 0);
    return start <= now;
  }

  hasEnded(): boolean {
    if (!this.data.end_date) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(this.data.end_date);
    end.setHours(0, 0, 0, 0);
    return end < now;
  }

  // Display methods
  getFormattedRate(): string | undefined {
    if (!this.data.hourly_rate) return undefined;
    return `${this.data.currency} ${this.data.hourly_rate.toFixed(2)}/hr`;
  }

  // Database mapping
  toDatabaseRow(): Record<string, any> {
    return {
      client_id: this.data.client_id,
      name: this.data.name,
      description: this.data.description,
      hourly_rate: this.data.hourly_rate,
      currency: this.data.currency,
      tax_rate_id: this.data.tax_rate_id,
      status: this.data.status,
      start_date: this.data.start_date,
      end_date: this.data.end_date,
    };
  }

  static fromDatabase(row: any): Project {
    return new Project({
      id: row.id,
      client_id: row.client_id,
      name: row.name,
      description: row.description || undefined,
      hourly_rate: row.hourly_rate ? parseFloat(row.hourly_rate) : undefined,
      currency: row.currency || 'EUR',
      tax_rate_id: row.tax_rate_id || undefined,
      status: row.status || 'active',
      start_date: row.start_date ? new Date(row.start_date) : undefined,
      end_date: row.end_date ? new Date(row.end_date) : undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}
