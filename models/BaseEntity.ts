import { BaseEntityType } from './schemas/BaseEntity';

/**
 * Abstract base class for all entity models
 * Provides common functionality
 */
export abstract class BaseEntity<T extends BaseEntityType> {
  protected data: T;

  constructor(data: T) {
    this.data = data;
  }

  // Common getters
  get id(): number | undefined {
    return this.data.id;
  }

  get createdAt(): Date | undefined {
    return this.data.created_at;
  }

  get updatedAt(): Date | undefined {
    return this.data.updated_at;
  }

  /**
   * Convert entity to plain JSON object
   */
  toJSON(): object {
    return { ...this.data };
  }

  /**
   * Check if entity has a valid ID (is persisted)
   */
  isPersisted(): boolean {
    return this.id !== undefined && this.id > 0;
  }

  /**
   * Get a safe copy of the internal data
   */
  protected getData(): T {
    return { ...this.data };
  }

  /**
   * For database insertion/update
   */
  abstract toDatabaseRow(): Record<string, any>;

  /**
   * Create instance from database row
   */
  static fromDatabase(row: any): BaseEntity<any> {
    throw new Error('fromDatabase must be implemented by subclass');
  }
}
