import JSZip from 'jszip';

export interface ExtractedSlide {
  slideNumber: number;
  extractedText: string;
  wordCount: number;
  estimatedSyllables: number;
}

export async function parseSlideFile(file: File): Promise<ExtractedSlide[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return parsePdfSlides(file);
  }
  if (lower.endsWith('.pptx')) {
    return parsePptxSlides(file);
  }
  const text = await file.text();
  const chunks = text
    .split(/\n---+\n|\n\n\n+/)
    .map((c) => normalizeLines(c))
    .filter(Boolean);
  return (chunks.length > 0 ? chunks : [normalizeLines(text)]).map((chunk, idx) => ({
    slideNumber: idx + 1,
    extractedText: chunk,
    wordCount: countThaiWords(chunk),
    estimatedSyllables: estimateThaiSyllables(chunk),
  }));
}

function normalizeLines(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
}

async function parsePdfSlides(file: File): Promise<ExtractedSlide[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  } catch {
    // Fallback if external CDN worker fails or is blocked offline
    pdfjs.GlobalWorkerOptions.workerSrc = '';
    pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
    } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  }

  const slides: ExtractedSlide[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    interface PositionedChunk {
      x: number;
      y: number;
      str: string;
    }

    const chunks: PositionedChunk[] = [];
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = item.str;
      if (!str.trim()) continue;
      const transform = 'transform' in item ? (item.transform as number[]) : [1, 0, 0, 1, 0, 0];
      chunks.push({
        x: transform[4] ?? 0,
        y: Math.round(transform[5] ?? 0),
        str,
      });
    }

    // Group items by vertical line baseline (tolerance +/- 4px)
    const linesMap: Array<{ y: number; items: PositionedChunk[] }> = [];
    for (const chunk of chunks) {
      const existing = linesMap.find((l) => Math.abs(l.y - chunk.y) <= 4);
      if (existing) {
        existing.items.push(chunk);
      } else {
        linesMap.push({ y: chunk.y, items: [chunk] });
      }
    }

    linesMap.sort((a, b) => b.y - a.y);

    const lines = linesMap
      .map((line) => {
        line.items.sort((a, b) => a.x - b.x);
        return line.items
          .map((it) => it.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(Boolean);

    const text = lines.join('\n');
    const cleanText = text || `(สไลด์หน้า ${i} — ไม่มีข้อความที่สกัดได้)`;
    slides.push({
      slideNumber: i,
      extractedText: cleanText,
      wordCount: countThaiWords(text),
      estimatedSyllables: estimateThaiSyllables(text),
    });
  }
  return slides;
}

function extractParagraphsFromSlideXml(xml: string): string {
  // Strip <a:fld> auto page-number fields so slide numbers aren't treated as content
  const withoutSlideNumFld = xml.replace(
    /<a:fld[^>]*type="slidenum"[\s\S]*?<\/a:fld>/g,
    ''
  );
  const paragraphs = Array.from(
    withoutSlideNumFld.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)
  );
  const lines: string[] = [];

  for (const p of paragraphs) {
    const textRuns = Array.from(p[1].matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g));
    const joined = decodeXmlEntities(textRuns.map((m) => m[1]).join(''))
      .replace(/[ \t]+/g, ' ')
      .trim();
    if (joined) {
      lines.push(joined);
    }
  }

  return lines.join('\n');
}

async function parsePptxSlides(file: File): Promise<ExtractedSlide[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      const numB = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
      return numA - numB;
    });

  const slides: ExtractedSlide[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const slidePath = slideFiles[i];
    const slideNumMatch = slidePath.match(/slide(\d+)\.xml/)?.[1];
    const xml = await zip.files[slidePath].async('string');
    let bodyText = extractParagraphsFromSlideXml(xml);

    // Try finding linked speaker notes via slide .rels first, fallback to notesSlide{num}.xml
    let notesPath: string | undefined;
    if (slideNumMatch) {
      const relsPath = `ppt/slides/_rels/slide${slideNumMatch}.xml.rels`;
      const relsFile = zip.files[relsPath];
      if (relsFile) {
        const relsXml = await relsFile.async('string');
        const notesMatch = relsXml.match(/Target="\.\.\/(notesSlides\/notesSlide\d+\.xml)"/);
        if (notesMatch) {
          notesPath = `ppt/${notesMatch[1]}`;
        }
      }
      if (!notesPath) {
        const fallbackNotesPath = `ppt/notesSlides/notesSlide${slideNumMatch}.xml`;
        if (zip.files[fallbackNotesPath]) {
          notesPath = fallbackNotesPath;
        }
      }
    }

    if (notesPath && zip.files[notesPath]) {
      const notesXml = await zip.files[notesPath].async('string');
      const notesText = extractParagraphsFromSlideXml(notesXml);
      if (notesText) {
        bodyText = bodyText
          ? `${bodyText}\n[โน้ตผู้พูด]: ${notesText}`
          : `[โน้ตผู้พูด]: ${notesText}`;
      }
    }

    const cleanText = bodyText || `(สไลด์หน้า ${i + 1} — ไม่มีข้อความ)`;
    slides.push({
      slideNumber: i + 1,
      extractedText: cleanText,
      wordCount: countThaiWords(bodyText),
      estimatedSyllables: estimateThaiSyllables(bodyText),
    });
  }
  return slides;
}

export function countThaiWords(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;

  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
      let count = 0;
      for (const seg of segmenter.segment(clean)) {
        if (seg.isWordLike) count += 1;
      }
      if (count > 0) return count;
    } catch {
      // Fallback below
    }
  }

  const thaiChars = (clean.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const nonThaiTokens = clean
    .replace(/[\u0E00-\u0E7F]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.round(thaiChars / 4.2) + nonThaiTokens;
}

export function estimateThaiSyllables(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;

  const thaiBaseChars = (
    clean.match(/[\u0E01-\u0E2E\u0E30\u0E32\u0E33\u0E40-\u0E45]/g) ?? []
  ).length;
  const thaiSyllables = Math.round(thaiBaseChars / 2.2);

  const latinTokens = clean.match(/[A-Za-z]+/g) ?? [];
  let englishSyllables = 0;
  for (const tok of latinTokens) {
    const groups = tok.match(/[aeiouyAEIOUY]+/g);
    englishSyllables += groups ? Math.max(1, groups.length) : 1;
  }

  const digitGroups = (clean.match(/\d+/g) ?? []).length;
  return Math.max(thaiBaseChars > 0 || latinTokens.length > 0 ? 1 : 0, thaiSyllables + englishSyllables + digitGroups);
}
