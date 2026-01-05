import { Pool } from 'pg';
import { BaseRepository } from './BaseRepository';
import { Company } from '../models/Company';

/**
 * Company repository
 */
export class CompanyRepository extends BaseRepository<Company> {
  constructor(pool: Pool) {
    super(pool, 'companies');
  }

  protected fromDatabaseRow(row: any): Company {
    return Company.fromDatabase(row);
  }

  /**
   * Find companies by type
   */
  async findByType(type: 'client' | 'supplier' | 'both'): Promise<Company[]> {
    return this.findAll('type = $1', [type]);
  }

  /**
   * Find all clients
   */
  async findClients(): Promise<Company[]> {
    return this.findAll("type IN ('client', 'both') AND is_active = true");
  }

  /**
   * Find all suppliers
   */
  async findSuppliers(): Promise<Company[]> {
    return this.findAll("type IN ('supplier', 'both') AND is_active = true");
  }

  /**
   * Find active companies
   */
  async findActive(): Promise<Company[]> {
    return this.findAll('is_active = true');
  }

  /**
   * Search companies by name
   */
  async searchByName(search: string): Promise<Company[]> {
    return this.findAll('name ILIKE $1', [`%${search}%`]);
  }

  /**
   * Find company by BTW number
   */
  async findByBtwNumber(btwNumber: string): Promise<Company | null> {
    const result = await this.findAll('btw_number = $1', [btwNumber]);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Find company by KVK number
   */
  async findByKvkNumber(kvkNumber: string): Promise<Company | null> {
    const result = await this.findAll('kvk_number = $1', [kvkNumber]);
    return result.length > 0 ? result[0] : null;
  }
}
