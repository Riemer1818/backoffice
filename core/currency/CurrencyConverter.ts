import fetch from 'node-fetch';

export interface ConversionResult {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  rate: number;
  date: string;
}

/**
 * Currency conversion service using Frankfurter API
 */
export class CurrencyConverter {
  private baseUrl = 'https://api.frankfurter.app';

  /**
   * Convert amount from one currency to another using historical rate for given date
   */
  async convert(
    amount: number,
    from: string,
    to: string = 'EUR',
    date?: string // YYYY-MM-DD format
  ): Promise<ConversionResult> {
    // If already in target currency, no conversion needed
    if (from.toUpperCase() === to.toUpperCase()) {
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: to,
        rate: 1,
        date: date || new Date().toISOString().split('T')[0],
      };
    }

    try {
      // Use historical rate if date provided, otherwise use latest
      const endpoint = date
        ? `${this.baseUrl}/${date}?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`
        : `${this.baseUrl}/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`;

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Currency conversion failed: ${response.statusText}`);
      }

      const data: any = await response.json();

      return {
        originalAmount: amount,
        originalCurrency: from.toUpperCase(),
        convertedAmount: data.rates[to.toUpperCase()],
        targetCurrency: to.toUpperCase(),
        rate: data.rates[to.toUpperCase()] / amount,
        date: data.date,
      };
    } catch (error) {
      console.error('Currency conversion error:', error);
      // Fallback: assume 1:1 conversion
      return {
        originalAmount: amount,
        originalCurrency: from,
        convertedAmount: amount,
        targetCurrency: to,
        rate: 1,
        date: date || new Date().toISOString().split('T')[0],
      };
    }
  }

  /**
   * Get current exchange rate
   */
  async getRate(from: string, to: string = 'EUR'): Promise<number> {
    if (from.toUpperCase() === to.toUpperCase()) {
      return 1;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to get exchange rate: ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.rates[to.toUpperCase()];
    } catch (error) {
      console.error('Failed to get exchange rate:', error);
      return 1; // Fallback
    }
  }
}
