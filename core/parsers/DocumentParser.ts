import pdfParse from 'pdf-parse';

export interface ParsedDocument {
  text: string;
  pageCount: number;
  metadata?: Record<string, any>;
}

/**
 * Document parsing service
 * Handles PDF, images (via OCR), and text extraction
 */
export class DocumentParser {
  /**
   * Parse a PDF document
   */
  async parsePDF(buffer: Buffer): Promise<ParsedDocument> {
    const data = await pdfParse(buffer);

    return {
      text: data.text,
      pageCount: data.numpages,
      metadata: data.info,
    };
  }

  /**
   * Parse an image using OCR (placeholder for Tesseract/Google Vision)
   * TODO: Implement OCR integration
   */
  async parseImage(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    // For now, return empty - implement Tesseract or Google Vision API
    console.warn('Image OCR not yet implemented');
    return {
      text: '',
      pageCount: 1,
      metadata: { mimeType },
    };
  }

  /**
   * Auto-detect document type and parse accordingly
   */
  async parse(buffer: Buffer, mimeType: string): Promise<ParsedDocument> {
    if (mimeType === 'application/pdf') {
      return this.parsePDF(buffer);
    }

    if (mimeType.startsWith('image/')) {
      return this.parseImage(buffer, mimeType);
    }

    throw new Error(`Unsupported document type: ${mimeType}`);
  }
}
