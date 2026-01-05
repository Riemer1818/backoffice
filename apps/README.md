# Automation Apps Framework

This directory contains modular automation applications that extend the backoffice functionality.

## Architecture

Each app is self-contained and uses shared services from `/core`:

```
/apps
  /invoice-ingestion     - Auto-extract invoices from email
  /[future-app]          - Additional automation apps

/core
  /llm                   - LLM service with LangFuse tracing
  /email                 - Email client (Gmail API)
  /parsers               - Document parsing (PDF, OCR)
  /queue                 - Job queue (future)
  /storage               - File storage (future)
```

## Available Apps

### Invoice Ingestion

Automatically processes invoices from email:
- Monitors Gmail for invoice emails
- Extracts PDF attachments
- Uses LLM to extract structured data
- Creates expense records in database

**Endpoints:**
- `POST /apps/invoice-ingestion/process` - Manually trigger ingestion
- `GET /apps/invoice-ingestion/auth/gmail` - Get Gmail OAuth URL

**Configuration:**
See `.env.template` for required environment variables.

## Creating New Apps

1. Create new directory in `/apps/[app-name]/`
2. Implement `[AppName]App.ts` with your logic
3. Create `routes.ts` for API endpoints
4. Register routes in `server.js`
5. Use shared services from `/core`

## Core Services

### LLM Service
```typescript
import { LLMService } from '../core/llm/LLMService';

const llm = new LLMService();
const result = await llm.call('Extract invoice data...', {
  traceName: 'extract-invoice',
  metadata: { app: 'invoice-ingestion' }
});
```

### Email Service
```typescript
import { EmailService } from '../core/email/EmailService';

const email = new EmailService();
const emails = await email.fetchEmails({
  hasAttachment: true,
  subject: 'invoice'
});
```

### Document Parser
```typescript
import { DocumentParser } from '../core/parsers/DocumentParser';

const parser = new DocumentParser();
const result = await parser.parsePDF(buffer);
```

## LangFuse Integration

All LLM calls are automatically traced when `LANGFUSE_ENABLED=true`:
- View traces at https://cloud.langfuse.com
- Monitor costs, latency, and quality
- Debug prompt/response issues
