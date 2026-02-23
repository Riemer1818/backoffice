import { router, publicProcedure } from '../trpc';

const expenseCategoryRouter = router({
  // Get all expense categories
  getAll: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query(
      `SELECT id, name, description, is_active
       FROM expense_categories
       WHERE is_active = true
       ORDER BY name ASC`
    );
    return result.rows;
  }),
});

export { expenseCategoryRouter };
