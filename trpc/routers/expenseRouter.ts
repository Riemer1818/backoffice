import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { ImapEmailService } from '../../core/email/ImapEmailService';
import { CurrencyConverter } from '../../core/currency/CurrencyConverter';

const expenseRouter = router({
  // Get all expenses (incoming invoices)
  getAll: publicProcedure
    .input(z.object({
      reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
      supplierId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = 'SELECT * FROM incoming_invoices WHERE 1=1';
      const params: any[] = [];

      if (input?.reviewStatus) {
        params.push(input.reviewStatus);
        query += ` AND review_status = $${params.length}`;
      }

      if (input?.supplierId) {
        params.push(input.supplierId);
        query += ` AND supplier_id = $${params.length}`;
      }

      query += ' ORDER BY invoice_date DESC';

      const result = await ctx.db.query(query, params);
      return result.rows;
    }),

  // Get single expense
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        `SELECT ii.*, p.name as project_name
         FROM incoming_invoices ii
         LEFT JOIN projects p ON ii.project_id = p.id
         WHERE ii.id = $1`,
        [input.id]
      );

      if (result.rows.length === 0) {
        throw new Error('Expense not found');
      }

      const expense = result.rows[0];

      // Get attachments with file data
      const attachmentsResult = await ctx.db.query(
        `SELECT id, file_name, file_type, file_size, attachment_type, file_data, created_at
         FROM invoice_attachments
         WHERE incoming_invoice_id = $1
         ORDER BY attachment_type DESC, created_at ASC`,
        [input.id]
      );

      // Convert file_data bytea to base64 for each attachment
      expense.attachments = attachmentsResult.rows.map((att: any) => ({
        ...att,
        file_data: att.file_data ? att.file_data.toString('base64') : null,
      }));
      expense.attachment_count = attachmentsResult.rows.length;

      // Convert PDF bytea to base64 if it exists (legacy support)
      if (expense.invoice_file) {
        expense.invoice_file_base64 = expense.invoice_file.toString('base64');
        delete expense.invoice_file; // Remove binary data
      }

      return expense;
    }),

  // Get pending for review
  getPending: publicProcedure
    .query(async ({ ctx }) => {
      const result = await ctx.db.query(
        `SELECT ii.*,
                (SELECT COUNT(*) FROM invoice_attachments WHERE incoming_invoice_id = ii.id) as attachment_count
         FROM incoming_invoices ii
         WHERE review_status = 'pending'
         ORDER BY invoice_date DESC`
      );

      return result.rows;
    }),

  // Approve expense
  approve: publicProcedure
    .input(z.object({
      id: z.number(),
      edits: z.object({
        supplier_name: z.string().optional(),
        description: z.string().optional(),
        subtotal: z.number().optional(),
        tax_amount: z.number().optional(),
        total_amount: z.number().optional(),
        project_id: z.number().nullable().optional(),
        currency: z.string().length(3).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Apply edits with currency conversion if provided
      if (input.edits) {
        // Get current expense data
        const currentExpense = await ctx.db.query(
          'SELECT invoice_date, original_currency, total_amount, subtotal, tax_amount FROM incoming_invoices WHERE id = $1',
          [input.id]
        );

        if (currentExpense.rows.length === 0) {
          throw new Error('Expense not found');
        }

        const invoiceDate = currentExpense.rows[0].invoice_date;
        const currentCurrency = currentExpense.rows[0].original_currency || 'EUR';
        const newCurrency = input.edits.currency || currentCurrency;

        console.log(`🔍 Approve: Current currency: ${currentCurrency}, New currency: ${newCurrency}`);
        console.log(`🔍 Approve: Input edits:`, input.edits);

        // Get the amounts to work with (either edited or current)
        const totalAmount = input.edits.total_amount ?? currentExpense.rows[0].total_amount;
        const subtotal = input.edits.subtotal ?? currentExpense.rows[0].subtotal;
        const taxAmount = input.edits.tax_amount ?? currentExpense.rows[0].tax_amount;

        console.log(`🔍 Approve: Using amounts - Total: ${totalAmount}, Subtotal: ${subtotal}, VAT: ${taxAmount}`);

        const setClauses: string[] = [];
        const params: any[] = [];

        // Update non-amount fields if provided
        if (input.edits.supplier_name !== undefined) {
          params.push(input.edits.supplier_name);
          setClauses.push(`supplier_name = $${params.length}`);
        }

        if (input.edits.description !== undefined) {
          params.push(input.edits.description);
          setClauses.push(`description = $${params.length}`);
        }

        if (input.edits.project_id !== undefined) {
          params.push(input.edits.project_id);
          setClauses.push(`project_id = $${params.length}`);
        }

        // Handle currency conversion
        if (newCurrency !== 'EUR') {
          const converter = new CurrencyConverter();
          const conversion = await converter.convert(
            totalAmount,
            newCurrency,
            'EUR',
            invoiceDate.toISOString().split('T')[0]
          );

          // Store original currency and amounts
          params.push(newCurrency);
          setClauses.push(`original_currency = $${params.length}`);

          params.push(totalAmount);
          setClauses.push(`original_amount = $${params.length}`);

          params.push(subtotal);
          setClauses.push(`original_subtotal = $${params.length}`);

          params.push(taxAmount);
          setClauses.push(`original_tax_amount = $${params.length}`);

          params.push(conversion.rate);
          setClauses.push(`exchange_rate = $${params.length}`);

          params.push(new Date(conversion.date));
          setClauses.push(`exchange_rate_date = $${params.length}`);

          // Calculate VAT percentage from original amounts
          const vatPercentage = subtotal > 0 ? taxAmount / subtotal : 0;

          // Convert total to EUR
          const eurTotal = conversion.convertedAmount;

          // Calculate EUR subtotal and VAT using the VAT percentage
          const eurSubtotal = eurTotal / (1 + vatPercentage);
          const eurVat = eurSubtotal * vatPercentage;

          params.push(eurTotal);
          setClauses.push(`total_amount = $${params.length}`);

          params.push(eurSubtotal);
          setClauses.push(`subtotal = $${params.length}`);

          params.push(eurVat);
          setClauses.push(`tax_amount = $${params.length}`);

          console.log(`💱 Converted ${newCurrency} ${totalAmount.toFixed(2)} to €${eurTotal.toFixed(2)} (VAT: ${(vatPercentage * 100).toFixed(1)}%)`);
        } else {
          // EUR - store amounts directly
          params.push('EUR');
          setClauses.push(`original_currency = $${params.length}`);

          params.push(null);
          setClauses.push(`original_amount = $${params.length}`);

          params.push(null);
          setClauses.push(`original_subtotal = $${params.length}`);

          params.push(null);
          setClauses.push(`original_tax_amount = $${params.length}`);

          params.push(1.0);
          setClauses.push(`exchange_rate = $${params.length}`);

          params.push(null);
          setClauses.push(`exchange_rate_date = $${params.length}`);

          if (input.edits.total_amount !== undefined) {
            params.push(input.edits.total_amount);
            setClauses.push(`total_amount = $${params.length}`);
          }

          if (input.edits.subtotal !== undefined) {
            params.push(input.edits.subtotal);
            setClauses.push(`subtotal = $${params.length}`);
          }

          if (input.edits.tax_amount !== undefined) {
            params.push(input.edits.tax_amount);
            setClauses.push(`tax_amount = $${params.length}`);
          }
        }

        if (setClauses.length > 0) {
          params.push(input.id);
          await ctx.db.query(
            `UPDATE incoming_invoices SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
            params
          );
        }
      }

      // Approve and mark as paid
      const result = await ctx.db.query(
        `UPDATE incoming_invoices
         SET review_status = 'approved', payment_status = 'paid', reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.id]
      );

      const expense = result.rows[0];

      // Mark source email as read if it has email metadata
      if (expense.source_email_id) {
        try {
          const emailService = new ImapEmailService({
            user: process.env.IMAP_USER || '',
            password: process.env.IMAP_PASSWORD || '',
            host: process.env.IMAP_HOST || '',
            port: parseInt(process.env.IMAP_PORT || '993'),
            tls: true,
          });
          await emailService.markAsRead(expense.source_email_id);
          console.log(`✅ Marked email ${expense.source_email_id} as read after approval`);
        } catch (error) {
          console.error('Failed to mark email as read:', error);
          // Don't fail the approval if email marking fails
        }
      }

      return expense;
    }),

  // Reject expense
  reject: publicProcedure
    .input(z.object({
      id: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.query(
        `UPDATE incoming_invoices
         SET review_status = 'rejected', reviewed_at = NOW(), updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [input.id]
      );

      return result.rows[0];
    }),

  // Update expense
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      data: z.object({
        supplier_name: z.string().optional(),
        description: z.string().optional(),
        subtotal: z.number().optional(),
        tax_amount: z.number().optional(),
        total_amount: z.number().optional(),
        project_id: z.number().nullable().optional(),
        currency: z.string().length(3).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      console.log(`🔍 Update: Received data:`, input.data);

      // Get current expense data
      const currentExpense = await ctx.db.query(
        'SELECT invoice_date, original_currency, total_amount, subtotal, tax_amount FROM incoming_invoices WHERE id = $1',
        [input.id]
      );

      if (currentExpense.rows.length === 0) {
        throw new Error('Expense not found');
      }

      const invoiceDate = currentExpense.rows[0].invoice_date;
      const currentCurrency = currentExpense.rows[0].original_currency || 'EUR';
      const newCurrency = input.data.currency || currentCurrency;

      console.log(`🔍 Update: Current currency: ${currentCurrency}, New currency: ${newCurrency}`);

      // Get the amounts to work with (either edited or current)
      const totalAmount = input.data.total_amount ?? currentExpense.rows[0].total_amount;
      const subtotal = input.data.subtotal ?? currentExpense.rows[0].subtotal;
      const taxAmount = input.data.tax_amount ?? currentExpense.rows[0].tax_amount;

      console.log(`🔍 Update: Using amounts - Total: ${totalAmount}, Subtotal: ${subtotal}, VAT: ${taxAmount}`);

      const setClauses: string[] = [];
      const params: any[] = [];

      // Update non-amount fields if provided
      if (input.data.supplier_name !== undefined) {
        params.push(input.data.supplier_name);
        setClauses.push(`supplier_name = $${params.length}`);
      }

      if (input.data.description !== undefined) {
        params.push(input.data.description);
        setClauses.push(`description = $${params.length}`);
      }

      if (input.data.project_id !== undefined) {
        params.push(input.data.project_id);
        setClauses.push(`project_id = $${params.length}`);
      }

      // Handle currency conversion
      if (newCurrency !== 'EUR') {
        const converter = new CurrencyConverter();
        const conversion = await converter.convert(
          totalAmount,
          newCurrency,
          'EUR',
          invoiceDate.toISOString().split('T')[0]
        );

        // Store original currency and amounts
        params.push(newCurrency);
        setClauses.push(`original_currency = $${params.length}`);

        params.push(totalAmount);
        setClauses.push(`original_amount = $${params.length}`);

        params.push(subtotal);
        setClauses.push(`original_subtotal = $${params.length}`);

        params.push(taxAmount);
        setClauses.push(`original_tax_amount = $${params.length}`);

        params.push(conversion.rate);
        setClauses.push(`exchange_rate = $${params.length}`);

        params.push(new Date(conversion.date));
        setClauses.push(`exchange_rate_date = $${params.length}`);

        // Calculate VAT percentage from original amounts
        const vatPercentage = subtotal > 0 ? taxAmount / subtotal : 0;

        // Convert total to EUR
        const eurTotal = conversion.convertedAmount;

        // Calculate EUR subtotal and VAT using the VAT percentage
        const eurSubtotal = eurTotal / (1 + vatPercentage);
        const eurVat = eurSubtotal * vatPercentage;

        params.push(eurTotal);
        setClauses.push(`total_amount = $${params.length}`);

        params.push(eurSubtotal);
        setClauses.push(`subtotal = $${params.length}`);

        params.push(eurVat);
        setClauses.push(`tax_amount = $${params.length}`);

        console.log(`💱 Converted ${newCurrency} ${totalAmount.toFixed(2)} to €${eurTotal.toFixed(2)} (VAT: ${(vatPercentage * 100).toFixed(1)}%)`);
      } else {
        // EUR - store amounts directly
        params.push('EUR');
        setClauses.push(`original_currency = $${params.length}`);

        params.push(null);
        setClauses.push(`original_amount = $${params.length}`);

        params.push(null);
        setClauses.push(`original_subtotal = $${params.length}`);

        params.push(null);
        setClauses.push(`original_tax_amount = $${params.length}`);

        params.push(1.0);
        setClauses.push(`exchange_rate = $${params.length}`);

        params.push(null);
        setClauses.push(`exchange_rate_date = $${params.length}`);

        if (input.data.total_amount !== undefined) {
          params.push(input.data.total_amount);
          setClauses.push(`total_amount = $${params.length}`);
        }

        if (input.data.subtotal !== undefined) {
          params.push(input.data.subtotal);
          setClauses.push(`subtotal = $${params.length}`);
        }

        if (input.data.tax_amount !== undefined) {
          params.push(input.data.tax_amount);
          setClauses.push(`tax_amount = $${params.length}`);
        }
      }

      if (setClauses.length > 0) {
        params.push(input.id);
        const sql = `UPDATE incoming_invoices SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`;
        console.log(`🔍 Update SQL:`, sql);
        console.log(`🔍 Update Params:`, params);
        const result = await ctx.db.query(sql, params);
        console.log(`✅ Update result - original_currency:`, result.rows[0].original_currency);
        return result.rows[0];
      }

      const result = await ctx.db.query('SELECT * FROM incoming_invoices WHERE id = $1', [input.id]);
      return result.rows[0];
    }),

  // Create manual invoice
  createManual: publicProcedure
    .input(z.object({
      supplier_name: z.string(),
      description: z.string().optional(),
      invoice_date: z.string(),
      subtotal: z.number(),
      tax_amount: z.number(),
      total_amount: z.number(),
      project_id: z.number().nullable().optional(),
      currency: z.string().length(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const converter = new CurrencyConverter();
      const currency = input.currency.toUpperCase();

      let eurTotal = input.total_amount;
      let eurSubtotal = input.subtotal;
      let eurVat = input.tax_amount;
      let exchangeRate = 1.0;
      let exchangeRateDate: Date | null = null;

      // Convert to EUR if needed
      if (currency !== 'EUR') {
        const conversion = await converter.convert(
          input.total_amount,
          currency,
          'EUR',
          input.invoice_date
        );

        exchangeRate = conversion.rate;
        exchangeRateDate = new Date(conversion.date);

        const ratio = conversion.convertedAmount / input.total_amount;
        eurTotal = conversion.convertedAmount;
        eurSubtotal = input.subtotal * ratio;
        eurVat = input.tax_amount * ratio;
      }

      const result = await ctx.db.query(
        `INSERT INTO incoming_invoices (
          supplier_name, description, invoice_date,
          subtotal, tax_amount, total_amount,
          original_currency, original_amount, original_subtotal, original_tax_amount,
          exchange_rate, exchange_rate_date,
          project_id, review_status, payment_status, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          input.supplier_name,
          input.description || '',
          input.invoice_date,
          eurSubtotal,
          eurVat,
          eurTotal,
          currency,
          currency !== 'EUR' ? input.total_amount : null,
          currency !== 'EUR' ? input.subtotal : null,
          currency !== 'EUR' ? input.tax_amount : null,
          exchangeRate,
          exchangeRateDate,
          input.project_id || null,
          'pending',
          'unpaid',
          'manual'
        ]
      );

      return result.rows[0];
    }),

  // Extract invoice data from PDF
  extractPdf: publicProcedure
    .input(z.object({
      pdfBase64: z.string(),
      filename: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { DocumentParser } = await import('../../core/parsers/DocumentParser');
      const { LLMService } = await import('../../core/llm/LLMService');

      const pdfBuffer = Buffer.from(input.pdfBase64.split(',')[1] || input.pdfBase64, 'base64');
      const parser = new DocumentParser();
      const llm = new LLMService();

      // Parse PDF to text
      const parsed = await parser.parse(pdfBuffer, 'application/pdf');

      if (!parsed.text.trim()) {
        throw new Error('Could not extract text from PDF');
      }

      // Step 1: Detect currency and language
      const currencySchema = `{
  "currency": "string (3-letter ISO code: USD, EUR, GBP, SGD, JPY, CHF, CAD, AUD, etc.)",
  "language": "string (2-letter ISO code: en, nl, fr, de, es, etc.)"
}`;

      const currencyPrompt = `Look at this invoice PDF. What currency and language is it in?

INSTRUCTIONS:
- Look for currency SYMBOLS: $, £, €, ¥, S$, C$, A$
- Look for currency CODES: USD, EUR, GBP, SGD, JPY, CHF, CAD, AUD
- If you see "$" determine if it's USD, SGD, CAD, or AUD from context
- For language, detect from the text content

${parsed.text}`;

      const currencyInfo = await llm.extractStructured<{ currency: string; language: string }>(
        currencyPrompt,
        currencySchema,
        { metadata: { app: 'manual-invoice-currency' } }
      );

      // Step 2: Extract full invoice data
      const invoiceSchema = `{
  "vendor": "string (company/supplier name)",
  "date": "string (YYYY-MM-DD format)",
  "amount": "number (total amount including VAT)",
  "vatAmount": "number (VAT amount if specified)",
  "description": "string (brief description)",
  "invoiceNumber": "string (invoice/reference number if present)"
}`;

      const invoiceData = await llm.extractStructured<{
        vendor: string;
        date: string;
        amount: number;
        vatAmount?: number;
        description: string;
        invoiceNumber?: string;
      }>(parsed.text, invoiceSchema, { metadata: { app: 'manual-invoice-extraction' } });

      return {
        supplier_name: invoiceData.vendor,
        description: invoiceData.description,
        invoice_date: invoiceData.date,
        subtotal: invoiceData.amount - (invoiceData.vatAmount || 0),
        tax_amount: invoiceData.vatAmount || 0,
        total_amount: invoiceData.amount,
        currency: currencyInfo.currency,
        language: currencyInfo.language,
      };
    }),

  // Delete expense
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.query('DELETE FROM incoming_invoices WHERE id = $1', [input.id]);
      return { success: true };
    }),

  // Upload PDF
  uploadPdf: publicProcedure
    .input(z.object({
      id: z.number(),
      pdfBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pdfBuffer = Buffer.from(input.pdfBase64, 'base64');

      const result = await ctx.db.query(
        `UPDATE incoming_invoices
         SET invoice_file = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [pdfBuffer, input.id]
      );

      return result.rows[0];
    }),
});

export { expenseRouter };
