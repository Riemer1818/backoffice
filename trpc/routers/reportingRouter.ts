import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const dashboardStatsSchema = z.object({
  income_this_month: z.number(),
  expenses_this_month: z.number(),
  profit_this_month: z.number(),
  vat_this_quarter: z.number(),
  vat_to_pay_total: z.number(),
  estimated_income_tax_ytd: z.number(),
  pending_expenses_count: z.number(),
  pending_expenses_amount: z.number(),
  active_projects_count: z.number(),
  income_ytd: z.number(),
  expenses_ytd: z.number(),
  profit_ytd: z.number(),
});

const reportingRouter = router({
  // Get dashboard stats
  getDashboardStats: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM dashboard_stats
      `);

      const row = result.rows[0];

      // Convert PostgreSQL numeric strings to numbers
      return {
        income_this_month: parseFloat(row.income_this_month) || 0,
        expenses_this_month: parseFloat(row.expenses_this_month) || 0,
        profit_this_month: parseFloat(row.profit_this_month) || 0,
        vat_this_quarter: parseFloat(row.vat_this_quarter) || 0,
        vat_to_pay_total: parseFloat(row.vat_to_pay_total) || 0,
        estimated_income_tax_ytd: parseFloat(row.estimated_income_tax_ytd) || 0,
        pending_expenses_count: parseInt(row.pending_expenses_count) || 0,
        pending_expenses_amount: parseFloat(row.pending_expenses_amount) || 0,
        active_projects_count: parseInt(row.active_projects_count) || 0,
        income_ytd: parseFloat(row.income_ytd) || 0,
        expenses_ytd: parseFloat(row.expenses_ytd) || 0,
        profit_ytd: parseFloat(row.profit_ytd) || 0,
      };
    }),

  // Get profit & loss summary
  getProfitLossSummary: publicProcedure
    .input(z.object({
      limit: z.number().default(12),
    }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit || 12;
      const result = await ctx.db.query(`
        SELECT * FROM profit_loss_summary
        ORDER BY period DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    }),

  // Get VAT summary
  getVATSummary: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM vat_summary_by_quarter
        ORDER BY year DESC, quarter DESC
      `);

      return result.rows;
    }),

  // Get VAT declaration
  getVATDeclaration: publicProcedure
    .input(z.object({
      year: z.number().optional(),
      quarter: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM vat_declaration';
      const params = [];

      if (input?.year) {
        params.push(input.year);
        query += ` WHERE year = $${params.length}`;
      }

      if (input?.quarter) {
        params.push(input.quarter);
        query += params.length === 1 ? ` WHERE quarter = $${params.length}` : ` AND quarter = $${params.length}`;
      }

      query += ' ORDER BY year DESC, quarter DESC';

      const result = await ctx.db.query(query, params);
      return result.rows;
    }),

  // Get income by client
  getIncomeByClient: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM income_by_client
        ORDER BY revenue_incl_vat DESC
      `);

      return result.rows;
    }),

  // Get expenses by supplier
  getExpensesBySupplier: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM expenses_by_supplier
        ORDER BY total_incl_vat DESC
      `);

      return result.rows;
    }),

  // Get project profitability
  getProjectProfitability: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM project_profitability
        ORDER BY profit_excl_vat DESC
      `);

      return result.rows;
    }),

  // Get expenses by category
  getExpensesByCategory: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM expenses_by_category
        ORDER BY total_incl_vat DESC
      `);

      return result.rows;
    }),

  // Get detailed profit & loss (all transactions)
  getProfitLoss: publicProcedure
    .input(z.object({
      year: z.number().optional(),
      month: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM profit_loss WHERE 1=1';
      const params: any[] = [];

      if (input?.year) {
        params.push(input.year);
        query += ` AND EXTRACT(YEAR FROM period) = $${params.length}`;
      }

      if (input?.month) {
        params.push(input.month);
        query += ` AND EXTRACT(MONTH FROM period) = $${params.length}`;
      }

      query += ' ORDER BY period DESC, type';

      const result = await ctx.db.query(query, params);
      return result.rows;
    }),

  // Get outstanding invoices (unpaid)
  getOutstandingInvoices: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT
          i.id,
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          i.total_amount,
          i.currency,
          i.status,
          c.name as client_name,
          p.name as project_name,
          CASE
            WHEN i.due_date < CURRENT_DATE THEN 'overdue'
            WHEN i.due_date < CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
            ELSE 'outstanding'
          END as urgency
        FROM invoices i
        LEFT JOIN companies c ON i.client_id = c.id
        LEFT JOIN projects p ON i.project_id = p.id
        WHERE i.status IN ('sent', 'overdue')
        ORDER BY i.due_date ASC
      `);

      return result.rows.map(row => ({
        ...row,
        total_amount: parseFloat(row.total_amount),
      }));
    }),

  // Get income/expense trend for chart (last 6 months)
  getIncomeExpenseTrend: publicProcedure
    .input(z.object({
      months: z.number().default(6),
    }).optional())
    .query(async ({ ctx, input }) => {
      const months = input?.months || 6;
      const result = await ctx.db.query(`
        SELECT
          period,
          income_excl_vat,
          expense_excl_vat,
          profit_excl_vat
        FROM profit_loss_summary
        WHERE period >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${months} months')
        ORDER BY period ASC
      `);

      return result.rows.map(row => ({
        period: row.period,
        income: parseFloat(row.income_excl_vat) || 0,
        expenses: parseFloat(row.expense_excl_vat) || 0,
        profit: parseFloat(row.profit_excl_vat) || 0,
      }));
    }),
});

export { reportingRouter };
