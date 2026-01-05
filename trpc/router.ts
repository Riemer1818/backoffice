import { router } from './trpc';
import { companyRouter } from './routers/companyRouter';
import { projectRouter } from './routers/projectRouter';
import { invoiceRouter } from './routers/invoiceRouter';
import { expenseRouter } from './routers/expenseRouter';
import { reportingRouter } from './routers/reportingRouter';
import { timeEntriesRouter } from './routers/timeEntriesRouter';

export const appRouter = router({
  company: companyRouter,
  project: projectRouter,
  invoice: invoiceRouter,
  expense: expenseRouter,
  reporting: reportingRouter,
  timeEntries: timeEntriesRouter,
});

export type AppRouter = typeof appRouter;
