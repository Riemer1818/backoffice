import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { LangFuseService } from './LangFuseService';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface LLMCallOptions {
  traceName: string;
  metadata?: Record<string, any>;
}

/**
 * Centralized LLM service with LangFuse tracing
 * All LLM calls in the application should go through this service
 */
export class LLMService {
  private langfuseService: LangFuseService;
  private defaultModel: ChatGoogleGenerativeAI;

  constructor() {
    this.langfuseService = LangFuseService.getInstance();
    this.defaultModel = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.0-flash',
      temperature: 0.7,
    });
  }

  /**
   * Make an LLM call with automatic tracing
   */
  async call(
    prompt: string,
    options: LLMCallOptions & LLMOptions = { traceName: 'llm-call' }
  ): Promise<string> {
    const trace = this.langfuseService.createTrace(options.traceName, {
      ...options.metadata,
      model: options.model || 'gemini-2.0-flash',
    });

    const generation = trace.generation({
      name: options.traceName,
      input: prompt,
      model: options.model || 'gemini-2.0-flash',
    });

    try {
      const model = options.model
        ? new ChatGoogleGenerativeAI({
            apiKey: process.env.GEMINI_API_KEY,
            model: options.model,
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxTokens,
          })
        : this.defaultModel;

      const response = await model.invoke(prompt);
      const output = response.content.toString();

      generation.end({
        output,
      });

      return output;
    } catch (error) {
      generation.end({
        output: null,
        statusMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Extract structured data from text using LLM with retries
   */
  async extractStructured<T>(
    text: string,
    schema: string,
    options: Omit<LLMCallOptions, 'traceName'> = {}
  ): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let cleaned = '';
      try {
        const prompt = `Extract structured data from the following text according to the schema.

CRITICAL INSTRUCTIONS:
1. Return ONLY valid JSON. No markdown code blocks, no explanations, no extra text.
2. The response must start with { and end with }. Use double quotes for all strings.
3. For currency field: Look very carefully for currency symbols ($, £, €, ¥, S$) or codes (USD, GBP, EUR, SGD, JPY) in the document.
4. DO NOT assume EUR - only use EUR if you see € or "EUR" explicitly in the invoice.
5. Pay attention to context: vendor location, currency symbol placement, and currency codes.

Schema:
${schema}

Text:
${text}

Return valid JSON now:`;

        const response = await this.call(prompt, {
          ...options,
          traceName: 'extract-structured',
          temperature: 0.1,
        });

        // Clean response (remove markdown code blocks if present)
        cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Try to extract JSON if response contains extra text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }

        return JSON.parse(cleaned);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

        // Log raw response for debugging (only first 300 chars to avoid spam)
        if (cleaned && attempt === 1) {
          console.error('Problematic response:', cleaned.substring(0, 300));
        }

        if (attempt === maxRetries) {
          console.error('All retries exhausted. Last response was invalid JSON.');
        } else {
          console.log(`Retrying in ${attempt}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    throw new Error(`Failed to extract structured data after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Shutdown and flush all traces
   */
  async shutdown() {
    await this.langfuseService.shutdown();
  }
}