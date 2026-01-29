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

      // Get individual custom benefits for this year
      const customBenefitsQuery = `
        SELECT tb.name, tb.amount
        FROM tax_benefits tb
        JOIN user_benefit_selections ubs ON ubs.benefit_id = tb.id AND ubs.is_enabled = true
        JOIN tax_years ty ON ty.id = tb.tax_year_id
        WHERE ty.year = $1
          AND tb.benefit_type NOT IN ('zelfstandigenaftrek', 'startersaftrek', 'mkb_winstvrijstelling')
          AND tb.amount IS NOT NULL
        ORDER BY tb.name
      `;

      const customBenefitsResult = await ctx.db.query(customBenefitsQuery, [parseInt(row.year)]);

      return {
        year: parseInt(row.year),
        gross_profit: parseFloat(row.gross_profit) || 0,
        self_employed_deduction: parseFloat(row.self_employed_deduction) || 0,
        startup_deduction: parseFloat(row.startup_deduction) || 0,
        custom_deductions: parseFloat(row.custom_deductions) || 0,
        custom_benefits: customBenefitsResult.rows.map(b => ({
          name: b.name,
          amount: parseFloat(b.amount),
        })),
        mkb_profit_exemption: parseFloat(row.mkb_profit_exemption) || 0,
        profit_after_deductions: parseFloat(row.profit_after_deductions) || 0,
        mkb_exemption_amount: parseFloat(row.mkb_exemption_amount) || 0,
        taxable_income: parseFloat(row.taxable_income) || 0,
        bracket_1_limit: parseFloat(row.bracket_1_limit) || 0,
        bracket_1_rate: parseFloat(row.bracket_1_rate) || 0,
        tax_bracket_1: parseFloat(row.tax_bracket_1) || 0,
        bracket_2_rate: parseFloat(row.bracket_2_rate) || 0,
        tax_bracket_2: parseFloat(row.tax_bracket_2) || 0,
        total_income_tax_before_credits: parseFloat(row.total_income_tax_before_credits) || 0,
        algemene_heffingskorting: parseFloat(row.algemene_heffingskorting) || 0,
        arbeidskorting: parseFloat(row.arbeidskorting) || 0,
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
        exports_non_eu: parseFloat(row.exports_non_eu) || 0,
        exports_eu: parseFloat(row.exports_eu) || 0,
        imports_non_eu_revenue: parseFloat(row.imports_non_eu_revenue) || 0,
        imports_non_eu_vat: parseFloat(row.imports_non_eu_vat) || 0,
        imports_eu_revenue: parseFloat(row.imports_eu_revenue) || 0,
        imports_eu_vat: parseFloat(row.imports_eu_vat) || 0,
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

  // Get all tax configurations (years with brackets and benefits)
  getAllTaxConfigurations: publicProcedure
    .query(async ({ ctx }) => {
      // Get all years with their brackets, benefits, and user settings
      const yearsResult = await ctx.db.query(`
        SELECT
          ty.id as year_id,
          ty.year,
          ty.is_active
        FROM tax_years ty
        ORDER BY ty.year ASC
      `);

      const configs = await Promise.all(yearsResult.rows.map(async (yearRow) => {
        // Get brackets for this year
        const bracketsResult = await ctx.db.query(`
          SELECT *
          FROM income_tax_brackets
          WHERE tax_year_id = $1
          ORDER BY bracket_order
        `, [yearRow.year_id]);

        // Get benefits for this year with their selection status
        const benefitsResult = await ctx.db.query(`
          SELECT
            tb.*,
            COALESCE(ubs.is_enabled, false) as is_enabled
          FROM tax_benefits tb
          LEFT JOIN user_benefit_selections ubs ON ubs.benefit_id = tb.id
          WHERE tb.tax_year_id = $1
          ORDER BY tb.benefit_type
        `, [yearRow.year_id]);

        // Get user settings for this year
        const settingsResult = await ctx.db.query(`
          SELECT *
          FROM user_tax_settings
          WHERE tax_year_id = $1
        `, [yearRow.year_id]);

        return {
          year: {
            id: yearRow.year_id,
            year: yearRow.year,
            is_active: yearRow.is_active,
          },
          brackets: bracketsResult.rows.map(b => ({
            id: b.id,
            bracket_order: b.bracket_order,
            income_from: parseFloat(b.income_from),
            income_to: b.income_to ? parseFloat(b.income_to) : null,
            rate: parseFloat(b.rate),
          })),
          benefits: benefitsResult.rows.map(b => ({
            id: b.id,
            benefit_type: b.benefit_type,
            name: b.name,
            amount: b.amount ? parseFloat(b.amount) : null,
            percentage: b.percentage ? parseFloat(b.percentage) : null,
            description: b.description,
            is_active: b.is_active,
            is_enabled: b.is_enabled,
            requires_hours_criterion: b.requires_hours_criterion,
            minimum_hours_required: b.minimum_hours_required,
            eligibility_criteria: b.eligibility_criteria,
            max_usage_count: b.max_usage_count,
          })),
          userSettings: settingsResult.rows.length > 0 ? {
            id: settingsResult.rows[0].id,
            applies_zelfstandigenaftrek: settingsResult.rows[0].applies_zelfstandigenaftrek,
            applies_startersaftrek: settingsResult.rows[0].applies_startersaftrek,
            applies_mkb_winstvrijstelling: settingsResult.rows[0].applies_mkb_winstvrijstelling,
            meets_hours_criterion: settingsResult.rows[0].meets_hours_criterion,
            starter_years_used: settingsResult.rows[0].starter_years_used,
            notes: settingsResult.rows[0].notes,
          } : null,
        };
      }));

      return configs;
    }),

  // Update user tax settings for a specific year
  updateUserTaxSettings: publicProcedure
    .input(z.object({
      year: z.number(),
      applies_zelfstandigenaftrek: z.boolean(),
      applies_startersaftrek: z.boolean(),
      applies_mkb_winstvrijstelling: z.boolean(),
      meets_hours_criterion: z.boolean().optional(),
      starter_years_used: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First get the tax_year_id
      const yearResult = await ctx.db.query(
        'SELECT id FROM tax_years WHERE year = $1',
        [input.year]
      );

      if (yearResult.rows.length === 0) {
        throw new Error(`Tax year ${input.year} not found`);
      }

      const taxYearId = yearResult.rows[0].id;

      // Upsert user settings
      const result = await ctx.db.query(
        `INSERT INTO user_tax_settings
          (tax_year_id, applies_zelfstandigenaftrek, applies_startersaftrek, applies_mkb_winstvrijstelling, meets_hours_criterion, starter_years_used, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tax_year_id)
         DO UPDATE SET
           applies_zelfstandigenaftrek = EXCLUDED.applies_zelfstandigenaftrek,
           applies_startersaftrek = EXCLUDED.applies_startersaftrek,
           applies_mkb_winstvrijstelling = EXCLUDED.applies_mkb_winstvrijstelling,
           meets_hours_criterion = EXCLUDED.meets_hours_criterion,
           starter_years_used = EXCLUDED.starter_years_used,
           notes = EXCLUDED.notes,
           updated_at = NOW()
         RETURNING *`,
        [
          taxYearId,
          input.applies_zelfstandigenaftrek,
          input.applies_startersaftrek,
          input.applies_mkb_winstvrijstelling,
          input.meets_hours_criterion ?? true,
          input.starter_years_used ?? 0,
          input.notes || null
        ]
      );

      return { success: true, settings: result.rows[0] };
    }),

  // Create a new custom tax benefit
  createCustomBenefit: publicProcedure
    .input(z.object({
      year: z.number(),
      benefit_type: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      amount: z.number().optional(),
      percentage: z.number().optional(),
      requires_hours_criterion: z.boolean().optional(),
      minimum_hours_required: z.number().optional(),
      eligibility_criteria: z.string().optional(),
      max_usage_count: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the tax_year_id
      const yearResult = await ctx.db.query(
        'SELECT id FROM tax_years WHERE year = $1',
        [input.year]
      );

      if (yearResult.rows.length === 0) {
        throw new Error(`Tax year ${input.year} not found`);
      }

      const taxYearId = yearResult.rows[0].id;

      // Insert the new benefit
      const benefitResult = await ctx.db.query(
        `INSERT INTO tax_benefits
          (tax_year_id, benefit_type, name, description, amount, percentage, requires_hours_criterion, minimum_hours_required, eligibility_criteria, max_usage_count, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         RETURNING *`,
        [
          taxYearId,
          input.benefit_type,
          input.name,
          input.description || null,
          input.amount || null,
          input.percentage || null,
          input.requires_hours_criterion || false,
          input.minimum_hours_required || null,
          input.eligibility_criteria || null,
          input.max_usage_count || null,
        ]
      );

      const benefitId = benefitResult.rows[0].id;

      // Create a selection entry for this benefit (disabled by default)
      await ctx.db.query(
        `INSERT INTO user_benefit_selections (benefit_id, is_enabled)
         VALUES ($1, false)
         ON CONFLICT (benefit_id) DO NOTHING`,
        [benefitId]
      );

      return { success: true, benefit: benefitResult.rows[0] };
    }),

  // Toggle a benefit on/off
  toggleBenefit: publicProcedure
    .input(z.object({
      benefitId: z.number(),
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        `INSERT INTO user_benefit_selections (benefit_id, is_enabled, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (benefit_id)
         DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           updated_at = NOW()
         RETURNING *`,
        [input.benefitId, input.isEnabled]
      );

      return { success: true, selection: result.rows[0] };
    }),

  // Update an existing benefit
  updateBenefit: publicProcedure
    .input(z.object({
      benefitId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      amount: z.number().optional(),
      percentage: z.number().optional(),
      minimum_hours_required: z.number().optional(),
      eligibility_criteria: z.string().optional(),
      max_usage_count: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (input.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(input.name);
      }
      if (input.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(input.description || null);
      }
      if (input.amount !== undefined) {
        updates.push(`amount = $${paramCount++}`);
        values.push(input.amount || null);
      }
      if (input.percentage !== undefined) {
        updates.push(`percentage = $${paramCount++}`);
        values.push(input.percentage || null);
      }
      if (input.minimum_hours_required !== undefined) {
        updates.push(`minimum_hours_required = $${paramCount++}`);
        values.push(input.minimum_hours_required || null);
      }
      if (input.eligibility_criteria !== undefined) {
        updates.push(`eligibility_criteria = $${paramCount++}`);
        values.push(input.eligibility_criteria || null);
      }
      if (input.max_usage_count !== undefined) {
        updates.push(`max_usage_count = $${paramCount++}`);
        values.push(input.max_usage_count || null);
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      updates.push(`updated_at = NOW()`);
      values.push(input.benefitId);

      const result = await ctx.db.query(
        `UPDATE tax_benefits SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Benefit not found');
      }

      return { success: true, benefit: result.rows[0] };
    }),

  // Delete a custom benefit
  deleteBenefit: publicProcedure
    .input(z.object({
      benefitId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if this is one of the core benefits (don't allow deletion)
      const checkResult = await ctx.db.query(
        `SELECT benefit_type FROM tax_benefits WHERE id = $1`,
        [input.benefitId]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Benefit not found');
      }

      const benefitType = checkResult.rows[0].benefit_type;
      if (['zelfstandigenaftrek', 'startersaftrek', 'mkb_winstvrijstelling'].includes(benefitType)) {
        throw new Error('Cannot delete core tax benefits');
      }

      // Delete the benefit (cascade will delete the selection)
      await ctx.db.query(
        `DELETE FROM tax_benefits WHERE id = $1`,
        [input.benefitId]
      );

      return { success: true };
    }),

  // Get tax credits for a specific year
  getTaxCredits: publicProcedure
    .input(z.object({
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Get the tax_year_id
      const yearResult = await ctx.db.query(
        'SELECT id FROM tax_years WHERE year = $1',
        [input.year]
      );

      if (yearResult.rows.length === 0) {
        throw new Error(`Tax year ${input.year} not found`);
      }

      const taxYearId = yearResult.rows[0].id;

      // Get tax credits
      const creditsResult = await ctx.db.query(`
        SELECT
          tc.id,
          tc.credit_type,
          tc.name,
          tc.description,
          tc.max_amount,
          tc.phaseout_start,
          tc.phaseout_end,
          tc.phaseout_rate,
          COALESCE(utcs.is_enabled, false) as is_enabled
        FROM tax_credits tc
        LEFT JOIN user_tax_credit_selections utcs ON utcs.credit_id = tc.id
        WHERE tc.tax_year_id = $1
        ORDER BY tc.credit_type
      `, [taxYearId]);

      // Get arbeidskorting brackets if they exist
      const arbeidskortingResult = await ctx.db.query(`
        SELECT
          bracket_order,
          income_from,
          income_to,
          rate,
          base_amount,
          rate_applies_to_excess
        FROM arbeidskorting_brackets
        WHERE tax_year_id = $1
        ORDER BY bracket_order
      `, [taxYearId]);

      return {
        credits: creditsResult.rows.map(c => ({
          id: c.id,
          credit_type: c.credit_type,
          name: c.name,
          description: c.description,
          max_amount: c.max_amount ? parseFloat(c.max_amount) : null,
          phaseout_start: c.phaseout_start ? parseFloat(c.phaseout_start) : null,
          phaseout_end: c.phaseout_end ? parseFloat(c.phaseout_end) : null,
          phaseout_rate: c.phaseout_rate ? parseFloat(c.phaseout_rate) : null,
          is_enabled: c.is_enabled,
        })),
        arbeidskorting_brackets: arbeidskortingResult.rows.map(b => ({
          bracket_order: b.bracket_order,
          income_from: parseFloat(b.income_from),
          income_to: b.income_to ? parseFloat(b.income_to) : null,
          rate: b.rate ? parseFloat(b.rate) : null,
          base_amount: b.base_amount ? parseFloat(b.base_amount) : null,
          rate_applies_to_excess: b.rate_applies_to_excess,
        })),
      };
    }),
});

export { taxRouter };
