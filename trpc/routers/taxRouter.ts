import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const taxRouter = router({
  // Get income tax calculation for a specific year
  getIncomeTaxCalculation: publicProcedure
    .input(z.object({
      year: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM income_tax_calculation';
      const params: any[] = [];

      if (input?.year) {
        params.push(input.year);
        query += ` WHERE year = $${params.length}`;
      }

      query += ' ORDER BY year DESC LIMIT 1';

      const result = await ctx.db.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        year: parseInt(row.year),
        gross_profit: parseFloat(row.gross_profit) || 0,
        self_employed_deduction: parseFloat(row.self_employed_deduction) || 0,
        startup_deduction: parseFloat(row.startup_deduction) || 0,
        mkb_profit_exemption: parseFloat(row.mkb_profit_exemption) || 0,
        profit_after_deductions: parseFloat(row.profit_after_deductions) || 0,
        mkb_exemption_amount: parseFloat(row.mkb_exemption_amount) || 0,
        taxable_income: parseFloat(row.taxable_income) || 0,
        bracket_1_limit: parseFloat(row.bracket_1_limit) || 0,
        bracket_1_rate: parseFloat(row.bracket_1_rate) || 0,
        tax_bracket_1: parseFloat(row.tax_bracket_1) || 0,
        bracket_2_rate: parseFloat(row.bracket_2_rate) || 0,
        tax_bracket_2: parseFloat(row.tax_bracket_2) || 0,
        total_income_tax: parseFloat(row.total_income_tax) || 0,
        effective_tax_rate: parseFloat(row.effective_tax_rate) || 0,
        net_profit_after_tax: parseFloat(row.net_profit_after_tax) || 0,
      };
    }),

  // Get VAT settlement (quarterly breakdown with payments)
  getVATSettlement: publicProcedure
    .input(z.object({
      year: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM vat_settlement';
      const params: any[] = [];

      if (input?.year) {
        params.push(input.year);
        query += ` WHERE year = $${params.length}`;
      }

      query += ' ORDER BY year DESC, quarter DESC';

      const result = await ctx.db.query(query, params);

      return result.rows.map(row => ({
        year: parseInt(row.year),
        quarter: parseInt(row.quarter),
        period: row.period,
        high_rate_revenue: parseFloat(row.high_rate_revenue) || 0,
        high_rate_vat_collected: parseFloat(row.high_rate_vat_collected) || 0,
        low_rate_revenue: parseFloat(row.low_rate_revenue) || 0,
        low_rate_vat_collected: parseFloat(row.low_rate_vat_collected) || 0,
        zero_rate_revenue: parseFloat(row.zero_rate_revenue) || 0,
        input_vat: parseFloat(row.input_vat) || 0,
        net_vat_to_pay: parseFloat(row.net_vat_to_pay) || 0,
        amount_paid: parseFloat(row.amount_paid) || 0,
        payment_date: row.payment_date,
        balance: parseFloat(row.balance) || 0,
        status: row.status,
        expected_refund: parseFloat(row.expected_refund) || 0,
      }));
    }),

  // Get overall tax summary
  getTaxSummary: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query('SELECT * FROM tax_summary');

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        year: parseInt(row.year),
        gross_profit: parseFloat(row.gross_profit) || 0,
        taxable_income: parseFloat(row.taxable_income) || 0,
        income_tax_owed: parseFloat(row.income_tax_owed) || 0,
        effective_tax_rate: parseFloat(row.effective_tax_rate) || 0,
        vat_to_pay: parseFloat(row.vat_to_pay) || 0,
        vat_to_receive: parseFloat(row.vat_to_receive) || 0,
        total_tax_liability: parseFloat(row.total_tax_liability) || 0,
        total_tax_credit: parseFloat(row.total_tax_credit) || 0,
        net_tax_position: parseFloat(row.net_tax_position) || 0,
      };
    }),

  // Record VAT payment
  recordVATPayment: publicProcedure
    .input(z.object({
      year: z.number(),
      quarter: z.number().min(1).max(4),
      payment_date: z.string(),
      net_amount: z.number(),
      payment_reference: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        `INSERT INTO vat_payments (period_year, period_quarter, payment_date, net_amount, payment_reference, notes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ON CONSTRAINT idx_vat_payments_period
         DO UPDATE SET
           payment_date = EXCLUDED.payment_date,
           net_amount = EXCLUDED.net_amount,
           payment_reference = EXCLUDED.payment_reference,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [input.year, input.quarter, input.payment_date, input.net_amount, input.payment_reference || null, input.notes || null]
      );

      return { success: true, payment: result.rows[0] };
    }),
});

export { taxRouter };
