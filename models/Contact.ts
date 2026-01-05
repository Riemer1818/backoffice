import { BaseEntity } from './BaseEntity';
import { ContactSchema, ContactType } from './schemas/Contact';

/**
 * Contact entity - people within companies
 */
export class Contact extends BaseEntity<ContactType> {
  constructor(data: ContactType) {
    const validated = ContactSchema.parse(data);
    super(validated);
  }

  // Getters
  get companyId(): number {
    return this.data.company_id;
  }

  get firstName(): string {
    return this.data.first_name;
  }

  get lastName(): string {
    return this.data.last_name;
  }

  get role(): string | undefined {
    return this.data.role;
  }

  get email(): string | undefined {
    return this.data.email;
  }

  get phone(): string | undefined {
    return this.data.phone;
  }

  get isPrimary(): boolean {
    return this.data.is_primary ?? false;
  }

  get isActive(): boolean {
    return this.data.is_active ?? true;
  }

  get notes(): string | undefined {
    return this.data.notes;
  }

  // Display helpers
  getFullName(): string {
    return `${this.data.first_name} ${this.data.last_name}`;
  }

  getDisplayName(): string {
    const parts = [this.getFullName()];
    if (this.data.role) {
      parts.push(`(${this.data.role})`);
    }
    return parts.join(' ');
  }

  // Database mapping
  toDatabaseRow(): Record<string, any> {
    return {
      company_id: this.data.company_id,
      first_name: this.data.first_name,
      last_name: this.data.last_name,
      role: this.data.role,
      email: this.data.email,
      phone: this.data.phone,
      is_primary: this.data.is_primary,
      is_active: this.data.is_active,
      notes: this.data.notes,
    };
  }

  static fromDatabase(row: any): Contact {
    return new Contact({
      id: row.id,
      company_id: row.company_id,
      first_name: row.first_name,
      last_name: row.last_name,
      role: row.role || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      is_primary: row.is_primary ?? false,
      is_active: row.is_active ?? true,
      notes: row.notes || undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}
