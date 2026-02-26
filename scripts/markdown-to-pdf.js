const fs = require('fs-extra');
const path = require('path');
const MarkdownIt = require('markdown-it');
const puppeteer = require('puppeteer');

(async () => {
  const cwd = process.cwd();
  const inputPath = path.resolve(cwd, 'docs', 'SkillExchange_Presentation.md');
  const outputPath = path.resolve(cwd, 'docs', 'SkillExchange_Presentation.pdf');

  if (!fs.existsSync(inputPath)) {
    console.error('Input file not found:', inputPath);
    process.exit(1);
  }

  const md = new MarkdownIt({ html: true });
  const mdSrc = await fs.readFile(inputPath, 'utf8');
  const htmlBody = md.render(mdSrc);

  const cssPath = path.resolve(cwd, 'scripts', 'print.css');
  const css = fs.existsSync(cssPath) ? await fs.readFile(cssPath, 'utf8') : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${htmlBody}</body></html>`;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: outputPath, format: 'A4', printBackground: true });
  await browser.close();

  console.log('PDF generated:', outputPath);
})();