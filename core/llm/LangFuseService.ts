import Langfuse from 'langfuse';

/**
 * LangFuse observability service
 * Provides tracing, monitoring, and analytics for all LLM calls
 */
export class LangFuseService {
  private static instance: LangFuseService;
  private langfuse: Langfuse;

  private constructor() {
    const enabled = process.env.LANGFUSE_ENABLED === 'true';

    this.langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY || '',
      publicKey: process.env.LANGFUSE_PUBLIC_KEY || '',
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
      enabled,
    });
  }

  static getInstance(): LangFuseService {
    if (!LangFuseService.instance) {
      LangFuseService.instance = new LangFuseService();
    }
    return LangFuseService.instance;
  }

  /**
   * Create a new trace for tracking an operation
   */
  createTrace(name: string, metadata?: Record<string, any>) {
    return this.langfuse.trace({
      name,
      metadata,
      timestamp: new Date(),
    });
  }

  /**
   * Flush all pending events (call on shutdown)
   */
  async shutdown() {
    await this.langfuse.shutdownAsync();
  }

  /**
   * Get the underlying Langfuse client
   */
  getClient() {
    return this.langfuse;
  }
}