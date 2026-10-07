import type { Browser } from 'playwright-core';
import type { Logger } from '../log';

/**
 * Report PDFs: headless Chromium opens the app's own print view (`/report/print`, the same React report
 * the participant sees, laid out for print) signed in as the participant, waits for it to say it is ready,
 * and prints it. One browser is shared; each render gets a fresh context, so no state leaks between people.
 */
export interface PdfRenderer {
  render(input: { url: string; cookie: { name: string; value: string }; }): Promise<Buffer>;
  close(): Promise<void>;
}

export class PdfError extends Error {}

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>(r => this.queue.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

export function chromiumRenderer(opts: { executablePath?: string; timeoutMs: number; concurrency: number; log: Logger }): PdfRenderer {
  let browser: Promise<Browser> | null = null;
  const gate = new Semaphore(Math.max(1, opts.concurrency));
  const getBrowser = () => {
    browser ??= import('playwright-core').then(({ chromium }) => chromium.launch({
      executablePath: opts.executablePath || undefined,
      // In containers Chromium runs as a non root user without its own sandbox namespaces.
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
    })).catch(e => { browser = null; throw e; });
    return browser;
  };
  return {
    render: ({ url, cookie }) => gate.run(async () => {
      const started = Date.now();
      const b = await getBrowser();
      const context = await b.newContext({ viewport: { width: 1240, height: 1754 }, colorScheme: 'light', locale: 'en-US' });
      try {
        await context.addCookies([{ name: cookie.name, value: cookie.value, url, httpOnly: true, sameSite: 'Lax' }]);
        const page = await context.newPage();
        page.setDefaultTimeout(opts.timeoutMs);
        await page.emulateMedia({ media: 'print' });
        await page.goto(url, { waitUntil: 'load' });
        const state = await page.waitForSelector('[data-print-state="ready"], [data-print-state="error"]', { timeout: opts.timeoutMs });
        if ((await state.getAttribute('data-print-state')) === 'error') throw new PdfError('The print view could not load the report');
        await page.evaluate(() => document.fonts.ready);
        const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' } });
        opts.log.info('pdf rendered', { ms: Date.now() - started, bytes: pdf.length });
        return pdf;
      } finally {
        await context.close().catch(() => undefined);
      }
    }),
    async close() {
      const b = browser;
      browser = null;
      if (b) await (await b.catch(() => null))?.close();
    }
  };
}
