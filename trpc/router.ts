import { router } from './trpc';
import { companyRouter } from './routers/companyRouter';
import { projectRouter } from './routers/projectRouter';
import { invoiceRouter } from './routers/invoiceRouter';
import { expenseRouter } from './routers/expenseRouter';
import { reportingRouter } from './routers/reportingRouter';
import { timeEntriesRouter } from './routers/timeEntriesRouter';
import { contactRouter } from './routers/contactRouter';
import { contactAssociationRouter } from './routers/contactAssociationRouter';

export const appRouter = router({
  company: companyRouter,
  project: projectRouter,
  invoice: invoiceRouter,
  expense: expenseRouter,
  reporting: reportingRouter,
  timeEntries: timeEntriesRouter,
  contact: contactRouter,
  contactAssociation: contactAssociationRouter,
});

export type AppRouter = typeof appRouter;
