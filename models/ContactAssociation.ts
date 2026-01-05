import { BaseEntity } from './BaseEntity';
import { ContactAssociationSchema, ContactAssociationType } from './schemas/ContactAssociation';

/**
 * ContactAssociation entity - links contacts to companies/projects with specific roles
 */
export class ContactAssociation extends BaseEntity<ContactAssociationType> {
  constructor(data: ContactAssociationType) {
    const validated = ContactAssociationSchema.parse(data);
    super(validated);
  }

  // Getters
  get contactId(): number {
    return this.data.contact_id;
  }

  get companyId(): number | undefined {
    return this.data.company_id;
  }

  get projectId(): number | undefined {
    return this.data.project_id;
  }

  get role(): string | undefined {
    return this.data.role;
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

  // Database mapping
  toDatabaseRow(): Record<string, any> {
    return {
      contact_id: this.data.contact_id,
      company_id: this.data.company_id,
      project_id: this.data.project_id,
      role: this.data.role,
      is_primary: this.data.is_primary,
      is_active: this.data.is_active,
      notes: this.data.notes,
    };
  }

  static fromDatabase(row: any): ContactAssociation {
    return new ContactAssociation({
      id: row.id,
      contact_id: row.contact_id,
      company_id: row.company_id || undefined,
      project_id: row.project_id || undefined,
      role: row.role || undefined,
      is_primary: row.is_primary ?? false,
      is_active: row.is_active ?? true,
      notes: row.notes || undefined,
      created_at: row.created_at ? new Date(row.created_at) : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    });
  }
}
