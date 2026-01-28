import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

const execAsync = promisify(exec);

export interface InvoiceData {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  project_name: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  tax_rate: number;
  notes?: string;
}

export interface TimeEntryItem {
  date: string;
  description: string;
  chargeable_hours: number;
  hourly_rate: number;
  amount: number;
}

export class InvoicePdfGenerator {
  private templatePath: string;
  private outputDir: string;

  constructor() {
    // Resolve paths relative to project root (backoffice/)
    const projectRoot = path.resolve(__dirname, '../..');
    this.templatePath = path.join(projectRoot, 'templates/invoice.tex');
    this.outputDir = path.join(projectRoot, 'outputs/invoices');
  }

  /**
   * Generate PDF for an invoice
   */
  async generatePdf(invoiceId: number, db: Pool, summarize: boolean = true): Promise<Buffer> {
    // Fetch business info
    const businessInfoResult = await db.query('SELECT * FROM business_info LIMIT 1');
    const businessInfo = businessInfoResult.rows[0];

    if (!businessInfo) {
      throw new Error('Business info not found in database');
    }

    // Fetch invoice data
    const invoiceResult = await db.query(
      `SELECT i.*,
              c.name as client_name,
              c.email as client_email,
              c.phone as client_phone,
              c.street_address as client_address,
              c.postal_code as client_postal,
              c.city as client_city,
              c.kvk_number as client_kvk,
              c.btw_number as client_btw,
              p.name as project_name,
              p.hourly_rate
       FROM invoices i
       LEFT JOIN companies c ON i.client_id = c.id
       LEFT JOIN projects p ON i.project_id = p.id
       WHERE i.id = $1`,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const invoice = invoiceResult.rows[0];

    // Fetch time entries for this invoice
    const timeEntriesResult = await db.query(
      `SELECT te.date, te.notes, te.chargeable_hours, p.hourly_rate
       FROM time_entries te
       LEFT JOIN projects p ON te.project_id = p.id
       WHERE te.invoice_id = $1
       ORDER BY te.date ASC`,
      [invoiceId]
    );

    const timeEntries = timeEntriesResult.rows.map((entry: any) => ({
      date: entry.date,
      description: entry.notes || 'Werkzaamheden',
      chargeable_hours: parseFloat(entry.chargeable_hours),
      hourly_rate: parseFloat(entry.hourly_rate),
      amount: parseFloat(entry.chargeable_hours) * parseFloat(entry.hourly_rate),
    }));

    // Calculate tax rate percentage
    const taxRate = (parseFloat(invoice.tax_amount) / parseFloat(invoice.subtotal)) * 100;

    // Generate LaTeX content
    const latexContent = await this.generateLatex(invoice, timeEntries, taxRate, businessInfo, summarize);

    // Write LaTeX file
    await fs.mkdir(this.outputDir, { recursive: true });
    const texFilePath = path.join(this.outputDir, `invoice_${invoice.invoice_number}.tex`);
    await fs.writeFile(texFilePath, latexContent, 'utf-8');

    // Compile LaTeX to PDF using xelatex
    const { stdout, stderr } = await execAsync(
      `cd ${this.outputDir} && xelatex -interaction=nonstopmode invoice_${invoice.invoice_number}.tex`,
      { maxBuffer: 1024 * 1024 * 10 }
    );

    console.log('LaTeX compilation output:', stdout);
    if (stderr) {
      console.warn('LaTeX compilation warnings:', stderr);
    }

    // Read generated PDF
    const pdfPath = path.join(this.outputDir, `invoice_${invoice.invoice_number}.pdf`);
    const pdfBuffer = await fs.readFile(pdfPath);

    // Clean up auxiliary files
    const extensions = ['.aux', '.log', '.out', '.tex'];
    for (const ext of extensions) {
      try {
        await fs.unlink(path.join(this.outputDir, `invoice_${invoice.invoice_number}${ext}`));
      } catch (err) {
        // Ignore errors
      }
    }

    return pdfBuffer;
  }

  /**
   * Generate LaTeX content from template
   */
  private async generateLatex(invoice: any, timeEntries: TimeEntryItem[], taxRate: number, businessInfo: any, summarize: boolean): Promise<string> {
    // Read template
    const template = await fs.readFile(this.templatePath, 'utf-8');

    // Format invoice items
    let items: string;
    if (summarize && timeEntries.length > 0) {
      // Summarize all entries into one line
      const totalHours = timeEntries.reduce((sum, entry) => sum + entry.chargeable_hours, 0);
      const roundedHours = Math.ceil(totalHours); // Round up to whole hour
      const dates = timeEntries.map(e => new Date(e.date)).sort((a, b) => a.getTime() - b.getTime());
      const startDate = dates[0].toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const endDate = dates[dates.length - 1].toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const rate = timeEntries[0]?.hourly_rate || 0;
      const amount = roundedHours * rate;

      // Format: Description | Hours | Amount | VAT%
      items = `    Development services (${startDate} - ${endDate}) - ${timeEntries.length} time entries & ${roundedHours.toFixed(2)} & \\euro\\,${amount.toFixed(2)} & 21\\%\\\\`;
    } else {
      // Show individual entries
      items = timeEntries.map(entry => {
        const dateStr = new Date(entry.date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const description = this.escapeLatex(entry.notes || 'Werkzaamheden');
        const hours = entry.chargeable_hours.toFixed(2);
        const rate = entry.hourly_rate.toFixed(2);
        return `    ${dateStr} & ${description} (${hours}h @ \\euro\\,${rate}/h) & \\euro\\,${entry.amount.toFixed(2)} & 21\\%\\\\`;
      }).join('\n    \\midrule[0.3pt]\n');
    }

    // Replace placeholders
    const projectRoot = path.resolve(__dirname, '../..');
    const logoPath = path.join(projectRoot, 'assets/logo.png');

    let content = template
      .replace(/{{LOGO_PATH}}/g, logoPath)
      .replace(/{{BUSINESS_ADDRESS}}/g, businessInfo.street_address || '')
      .replace(/{{BUSINESS_POSTAL}}/g, businessInfo.postal_code || '')
      .replace(/{{BUSINESS_CITY}}/g, businessInfo.city || '')
      .replace(/{{BUSINESS_EMAIL}}/g, businessInfo.email || '')
      .replace(/{{BUSINESS_PHONE}}/g, businessInfo.phone || '')
      .replace(/{{KVK_NUMBER}}/g, businessInfo.kvk_number || '')
      .replace(/{{BTW_NUMBER}}/g, businessInfo.btw_number || '')
      .replace(/{{BUSINESS_IBAN}}/g, businessInfo.iban || '')
      .replace(/{{CLIENT_COMPANY}}/g, this.escapeLatex(invoice.client_name || ''))
      .replace(/{{CLIENT_CONTACT}}/g, '')
      .replace(/{{CLIENT_ADDRESS}}/g, this.escapeLatex(invoice.client_address || ''))
      .replace(/{{CLIENT_POSTAL}}/g, invoice.client_postal || '')
      .replace(/{{CLIENT_CITY}}/g, this.escapeLatex(invoice.client_city || ''))
      .replace(/{{CLIENT_KVK_BTW}}/g, invoice.client_kvk ? `KVK: ${invoice.client_kvk}` : '')
      .replace(/{{INVOICE_NUMBER}}/g, invoice.invoice_number)
      .replace(/{{INVOICE_DATE}}/g, new Date(invoice.invoice_date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }))
      .replace(/{{DUE_DATE}}/g, new Date(invoice.due_date).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }))
      .replace(/{{INVOICE_ITEMS}}/g, items)
      .replace(/{{SUBTOTAL}}/g, parseFloat(invoice.subtotal).toFixed(2))
      .replace(/{{TAX_RATE}}/g, taxRate.toFixed(0))
      .replace(/{{TAX_AMOUNT}}/g, parseFloat(invoice.tax_amount).toFixed(2))
      .replace(/{{TOTAL_AMOUNT}}/g, parseFloat(invoice.total_amount).toFixed(2));

    return content;
  }

  /**
   * Escape special LaTeX characters
   */
  private escapeLatex(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[&%$#_{}]/g, '\\$&')
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}');
  }
}
