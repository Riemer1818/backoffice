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
      model: 'gemini-2.0-flash-exp',
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
      model: options.model || 'gemini-2.0-flash-exp',
    });

    const generation = trace.generation({
      name: options.traceName,
      input: prompt,
      model: options.model || 'gemini-2.0-flash-exp',
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
   * Extract structured data from text using LLM
   */
  async extractStructured<T>(
    text: string,
    schema: string,
    options: Omit<LLMCallOptions, 'traceName'> = {}
  ): Promise<T> {
    const prompt = `Extract structured data from the following text according to the schema.
Return ONLY valid JSON, no markdown, no explanation.

Schema:
${schema}

Text:
${text}

JSON Output:`;

    const response = await this.call(prompt, {
      ...options,
      traceName: 'extract-structured',
      temperature: 0.1,
    });

    // Clean response (remove markdown code blocks if present)
    const cleaned = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  }

  /**
   * Shutdown and flush all traces
   */
  async shutdown() {
    await this.langfuseService.shutdown();
  }
}