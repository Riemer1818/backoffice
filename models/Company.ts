import { BaseEntity } from './BaseEntity';
import { CompanySchema, CompanyType } from './schemas/Company';

/**
 * Company entity - clients, suppliers, or both
 */
export class Company extends BaseEntity<CompanyType> {
  constructor(data: CompanyType) {
    const validated = CompanySchema.parse(data);
    super(validated);
  }

  // Getters
  get name(): string {
    return this.data.name;
  }

  get type(): 'client' | 'supplier' | 'both' {
    return this.data.type;
  }

  get email(): string | undefined {
    return this.data.email;
  }

  get phone(): string | undefined {
    return this.data.phone;
  }

  get mainContactPerson(): string | undefined {
    return this.data.main_contact_person;
  }

  // Type checkers
  isClient(): boolean {
    return this.data.type === 'client' || this.data.type === 'both';
  }

  isSupplier(): boolean {
    return this.data.type === 'supplier' || this.data.type === 'both';
  }

  isActive(): boolean {
    return this.data.is_active ?? true;
  }

  // Display helpers
  getFullAddress(): string | undefined {
    const parts = [];
    if (this.data.street_address) parts.push(this.data.street_address);
    if (this.data.postal_code || this.data.city) {
      parts.push([this.data.postal_code, this.data.city].filter(Boolean).join(' '));
    }
    if (this.data.country && this.data.country !== 'Netherlands') {
      parts.push(this.data.country);
    }
    return parts.length > 0 ? parts.join(', ') : undefined;
  }

  // Database mapping
  toDatabaseRow(): Record<string, any> {
    return {
      type: this.data.type,
      name: this.data.name,
      kvk_number: this.data.kvk_number,
      btw_number: this.data.btw_number,
      main_contact_person: this.data.main_contact_person,
      email: this.data.email,
      phone: this.data.phone,
      website: this.data.website,
      street_address: this.data.street_address,
      postal_code: this.data.postal_code,
      city: this.data.city,
      country: this.data.country,
      iban: this.data.iban,
      notes: this.data.notes,
      is_active: this.data.is_active,
    };
  }

  static fromDatabase(row: any): Company {
    return new Company({
      id: row.id,
      type: row.type,
      name: row.name,
      kvk_number: row.kvk_number || undefined,
      btw_number: row.btw_number || undefined,
      main_contact_person: row.main_contact_person || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      website: row.website || undefined,
      street_address: row.street_address || undefined,
      postal_code: row.postal_code || undefined,
      city: row.city || undefined,
      country: row.country || undefined,
      iban: row.iban || undefined,
      notes: row.notes || undefined,
      is_active: row.is_active ?? true,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}
