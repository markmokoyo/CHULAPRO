import JSZip from 'jszip';

export interface ExtractedSlide {
  slideNumber: number;
  extractedText: string;
  speakerScript?: string;
  imageDataUrl?: string;
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
  if (/\.(png|jpe?g|webp)$/i.test(lower)) {
    const imageDataUrl = await resizeImageFileToDataUrl(file, 800, 0.78);
    return [
      {
        slideNumber: 1,
        extractedText: file.name.replace(/\.[^.]+$/, ''),
        imageDataUrl,
        wordCount: 4,
        estimatedSyllables: 8,
      },
    ];
  }
  const text = await file.text();
  const chunks = text
    .split(/\n---+\n|\n\n\n+/)
    .map((c) => normalizeLines(c))
    .filter(Boolean);
  return (chunks.length > 0 ? chunks : [normalizeLines(text)]).map((chunk, idx) => ({
    slideNumber: idx + 1,
    extractedText: chunk,
    imageDataUrl: renderTextSlidePreviewDataUrl(idx + 1, chunk),
    wordCount: countThaiWords(chunk),
    estimatedSyllables: estimateThaiSyllables(chunk),
  }));
}

export async function parseMultipleImageSlides(files: File[]): Promise<ExtractedSlide[]> {
  const sorted = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  const slides: ExtractedSlide[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const f = sorted[i];
    const imageDataUrl = await resizeImageFileToDataUrl(f, 800, 0.78);
    const titleGuess = f.name.replace(/\.[^.]+$/, '');
    slides.push({
      slideNumber: i + 1,
      extractedText: titleGuess || `สไลด์หน้า ${i + 1}`,
      imageDataUrl,
      wordCount: countThaiWords(titleGuess),
      estimatedSyllables: estimateThaiSyllables(titleGuess),
    });
  }
  return slides;
}

export async function resizeImageFileToDataUrl(
  file: File,
  maxWidth: number = 800,
  quality: number = 0.78
): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined;
  const rawUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถโหลดรูปภาพสไลด์ได้'));
      el.src = rawUrl;
    });
    const scale = Math.min(1, maxWidth / Math.max(1, img.width));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

export function renderTextSlidePreviewDataUrl(
  slideNumber: number,
  text: string
): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const width = 640;
  const height = 360;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#EC3D6A';
  ctx.fillRect(0, 0, width, 8);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('[โน้ตผู้พูด]:'));
  const title = lines[0] || `สไลด์หน้า ${slideNumber}`;
  const bullets = lines.slice(1, 5);

  // Slide pill
  ctx.fillStyle = '#FCE8EE';
  ctx.fillRect(36, 30, 96, 24);
  ctx.fillStyle = '#BE2257';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`SLIDE ${String(slideNumber).padStart(2, '0')}`, 48, 46);

  // Title
  ctx.fillStyle = '#1F161A';
  ctx.font = 'bold 22px sans-serif';
  wrapCanvasText(ctx, title, 36, 88, width - 72, 28, 2);

  // Body lines
  ctx.fillStyle = '#475569';
  ctx.font = '15px sans-serif';
  let y = 156;
  for (const b of bullets) {
    if (y > 312) break;
    y = wrapCanvasText(ctx, `• ${b}`, 36, y, width - 72, 22, 2) + 8;
  }

  ctx.fillStyle = '#94A3B8';
  ctx.font = '11px sans-serif';
  ctx.fillText('CuePulse Slide Preview', 36, 336);

  return canvas.toDataURL('image/jpeg', 0.78);
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const chars = Array.from(text);
  let line = '';
  let drawn = 0;
  let currY = y;
  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      drawn += 1;
      if (drawn >= maxLines) {
        ctx.fillText(`${line.slice(0, -1)}...`, x, currY);
        return currY + lineHeight;
      }
      ctx.fillText(line, x, currY);
      line = chars[i];
      currY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line && drawn < maxLines) {
    ctx.fillText(line, x, currY);
    currY += lineHeight;
  }
  return currY;
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
    let imageDataUrl: string | undefined;

    if (typeof document !== 'undefined') {
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, 680 / Math.max(1, baseViewport.width));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          imageDataUrl = canvas.toDataURL('image/jpeg', 0.72);
        }
      } catch {
        imageDataUrl = renderTextSlidePreviewDataUrl(i, cleanText);
      }
    }

    slides.push({
      slideNumber: i,
      extractedText: cleanText,
      imageDataUrl,
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

    let notesText = '';
    if (notesPath && zip.files[notesPath]) {
      const notesXml = await zip.files[notesPath].async('string');
      notesText = extractParagraphsFromSlideXml(notesXml);
      if (notesText) {
        bodyText = bodyText
          ? `${bodyText}\n[โน้ตผู้พูด]: ${notesText}`
          : `[โน้ตผู้พูด]: ${notesText}`;
      }
    }

    const cleanText = bodyText || `(สไลด์หน้า ${i + 1} — ไม่มีข้อความ)`;
    const imageDataUrl = renderTextSlidePreviewDataUrl(i + 1, cleanText);
    slides.push({
      slideNumber: i + 1,
      extractedText: cleanText,
      speakerScript: notesText || undefined,
      imageDataUrl,
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
