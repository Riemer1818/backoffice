import { Pool } from 'pg';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { TimeEntryRepository } from '../repositories/TimeEntryRepository';
import { ContactRepository } from '../repositories/ContactRepository';
import { ContactAssociationRepository } from '../repositories/ContactAssociationRepository';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

export const createContext = () => {
  return {
    db: pool,
    repos: {
      company: new CompanyRepository(pool),
      project: new ProjectRepository(pool),
      timeEntry: new TimeEntryRepository(pool),
      contact: new ContactRepository(pool),
      contactAssociation: new ContactAssociationRepository(pool),
    },
  };
};

export type Context = ReturnType<typeof createContext>;
