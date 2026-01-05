import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

const taxRouter = router({
  // Get all tax years
  getTaxYears: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(`
        SELECT * FROM tax_years
        WHERE is_active = true
        ORDER BY year DESC
      `);
      return result.rows;
    }),

  // Get tax configuration for a specific year
  getTaxConfiguration: publicProcedure
    .input(z.object({
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Get tax year
      const yearResult = await ctx.db.query(`
        SELECT * FROM tax_years WHERE year = $1
      `, [input.year]);

      if (yearResult.rows.length === 0) {
        throw new Error(`Tax year ${input.year} not found`);
      }

      const taxYear = yearResult.rows[0];

      // Get income tax brackets
      const bracketsResult = await ctx.db.query(`
        SELECT * FROM income_tax_brackets
        WHERE tax_year_id = $1
        ORDER BY bracket_order ASC
      `, [taxYear.id]);

      // Get tax benefits
      const benefitsResult = await ctx.db.query(`
        SELECT * FROM tax_benefits
        WHERE tax_year_id = $1
        ORDER BY
          CASE benefit_type
            WHEN 'zelfstandigenaftrek' THEN 1
            WHEN 'startersaftrek' THEN 2
            WHEN 'mkb_winstvrijstelling' THEN 3
            ELSE 4
          END
      `, [taxYear.id]);

      // Get user settings
      const settingsResult = await ctx.db.query(`
        SELECT * FROM user_tax_settings
        WHERE tax_year_id = $1
      `, [taxYear.id]);

      return {
        year: taxYear,
        brackets: bracketsResult.rows.map(row => ({
          ...row,
          income_from: parseFloat(row.income_from),
          income_to: row.income_to ? parseFloat(row.income_to) : null,
          rate: parseFloat(row.rate),
        })),
        benefits: benefitsResult.rows.map(row => ({
          ...row,
          amount: row.amount ? parseFloat(row.amount) : null,
          percentage: row.percentage ? parseFloat(row.percentage) : null,
        })),
        userSettings: settingsResult.rows[0] || null,
      };
    }),

  // Get all tax configurations (for comparison view)
  getAllTaxConfigurations: publicProcedure
    .query(async ({ ctx }) => {
      const yearsResult = await ctx.db.query(`
        SELECT * FROM tax_years
        WHERE is_active = true
        ORDER BY year DESC
      `);

      const configurations = await Promise.all(
        yearsResult.rows.map(async (year) => {
          const bracketsResult = await ctx.db.query(`
            SELECT * FROM income_tax_brackets
            WHERE tax_year_id = $1
            ORDER BY bracket_order ASC
          `, [year.id]);

          const benefitsResult = await ctx.db.query(`
            SELECT * FROM tax_benefits
            WHERE tax_year_id = $1
            ORDER BY
              CASE benefit_type
                WHEN 'zelfstandigenaftrek' THEN 1
                WHEN 'startersaftrek' THEN 2
                WHEN 'mkb_winstvrijstelling' THEN 3
                ELSE 4
              END
          `, [year.id]);

          const settingsResult = await ctx.db.query(`
            SELECT * FROM user_tax_settings
            WHERE tax_year_id = $1
          `, [year.id]);

          return {
            year: year,
            brackets: bracketsResult.rows.map(row => ({
              ...row,
              income_from: parseFloat(row.income_from),
              income_to: row.income_to ? parseFloat(row.income_to) : null,
              rate: parseFloat(row.rate),
            })),
            benefits: benefitsResult.rows.map(row => ({
              ...row,
              amount: row.amount ? parseFloat(row.amount) : null,
              percentage: row.percentage ? parseFloat(row.percentage) : null,
            })),
            userSettings: settingsResult.rows[0] || null,
          };
        })
      );

      return configurations;
    }),

  // Update user tax settings for a specific year
  updateUserTaxSettings: publicProcedure
    .input(z.object({
      year: z.number(),
      applies_zelfstandigenaftrek: z.boolean(),
      applies_startersaftrek: z.boolean(),
      applies_mkb_winstvrijstelling: z.boolean(),
      meets_hours_criterion: z.boolean().optional(),
      starter_years_used: z.number().min(0).max(5).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get tax year ID
      const yearResult = await ctx.db.query(`
        SELECT id FROM tax_years WHERE year = $1
      `, [input.year]);

      if (yearResult.rows.length === 0) {
        throw new Error(`Tax year ${input.year} not found`);
      }

      const taxYearId = yearResult.rows[0].id;

      // Upsert user settings
      const result = await ctx.db.query(`
        INSERT INTO user_tax_settings (
          tax_year_id,
          applies_zelfstandigenaftrek,
          applies_startersaftrek,
          applies_mkb_winstvrijstelling,
          meets_hours_criterion,
          starter_years_used,
          notes,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        ON CONFLICT (tax_year_id)
        DO UPDATE SET
          applies_zelfstandigenaftrek = $2,
          applies_startersaftrek = $3,
          applies_mkb_winstvrijstelling = $4,
          meets_hours_criterion = COALESCE($5, user_tax_settings.meets_hours_criterion),
          starter_years_used = COALESCE($6, user_tax_settings.starter_years_used),
          notes = COALESCE($7, user_tax_settings.notes),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        taxYearId,
        input.applies_zelfstandigenaftrek,
        input.applies_startersaftrek,
        input.applies_mkb_winstvrijstelling,
        input.meets_hours_criterion ?? true,
        input.starter_years_used ?? 0,
        input.notes ?? null,
      ]);

      return result.rows[0];
    }),

  // Calculate tax impact for a given year and profit
  calculateTaxImpact: publicProcedure
    .input(z.object({
      year: z.number(),
      profit: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      // Get tax year
      const yearResult = await ctx.db.query(`
        SELECT * FROM tax_years WHERE year = $1
      `, [input.year]);

      if (yearResult.rows.length === 0) {
        throw new Error(`Tax year ${input.year} not found`);
      }

      const taxYearId = yearResult.rows[0].id;

      // Get user settings
      const settingsResult = await ctx.db.query(`
        SELECT * FROM user_tax_settings WHERE tax_year_id = $1
      `, [taxYearId]);

      const settings = settingsResult.rows[0];

      // Get benefits
      const benefitsResult = await ctx.db.query(`
        SELECT * FROM tax_benefits WHERE tax_year_id = $1
      `, [taxYearId]);

      const benefits = benefitsResult.rows;

      // Get brackets
      const bracketsResult = await ctx.db.query(`
        SELECT * FROM income_tax_brackets
        WHERE tax_year_id = $1
        ORDER BY bracket_order ASC
      `, [taxYearId]);

      const brackets = bracketsResult.rows;

      // Calculate deductions
      let totalDeductions = 0;
      const appliedDeductions = [];

      if (settings?.applies_zelfstandigenaftrek) {
        const benefit = benefits.find(b => b.benefit_type === 'zelfstandigenaftrek');
        if (benefit?.amount) {
          const amount = parseFloat(benefit.amount);
          totalDeductions += amount;
          appliedDeductions.push({
            name: benefit.name,
            amount: amount,
          });
        }
      }

      if (settings?.applies_startersaftrek) {
        const benefit = benefits.find(b => b.benefit_type === 'startersaftrek');
        if (benefit?.amount) {
          const amount = parseFloat(benefit.amount);
          totalDeductions += amount;
          appliedDeductions.push({
            name: benefit.name,
            amount: amount,
          });
        }
      }

      // Calculate taxable profit after deductions
      let taxableProfit = Math.max(0, input.profit - totalDeductions);

      // Apply MKB-winstvrijstelling
      let winstvrijstelling = 0;
      if (settings?.applies_mkb_winstvrijstelling) {
        const benefit = benefits.find(b => b.benefit_type === 'mkb_winstvrijstelling');
        if (benefit?.percentage && taxableProfit > 0) {
          const percentage = parseFloat(benefit.percentage);
          winstvrijstelling = (taxableProfit * percentage) / 100;
          appliedDeductions.push({
            name: benefit.name,
            amount: winstvrijstelling,
          });
        }
      }

      // Final taxable income
      const finalTaxableIncome = Math.max(0, taxableProfit - winstvrijstelling);

      // Calculate tax based on brackets
      let totalTax = 0;
      const taxPerBracket = [];

      for (const bracket of brackets) {
        const from = parseFloat(bracket.income_from);
        const to = bracket.income_to ? parseFloat(bracket.income_to) : Infinity;
        const rate = parseFloat(bracket.rate);

        if (finalTaxableIncome <= from) {
          break;
        }

        const bracketIncome = Math.min(finalTaxableIncome, to) - from;
        if (bracketIncome > 0) {
          const bracketTax = (bracketIncome * rate) / 100;
          totalTax += bracketTax;
          taxPerBracket.push({
            bracket_order: bracket.bracket_order,
            income_from: from,
            income_to: to === Infinity ? null : to,
            rate: rate,
            taxable_in_bracket: bracketIncome,
            tax_in_bracket: bracketTax,
          });
        }
      }

      return {
        profit: input.profit,
        totalDeductions,
        appliedDeductions,
        taxableProfit,
        winstvrijstelling,
        finalTaxableIncome,
        totalTax,
        taxPerBracket,
        effectiveRate: input.profit > 0 ? (totalTax / input.profit) * 100 : 0,
      };
    }),
});

export { taxRouter };
