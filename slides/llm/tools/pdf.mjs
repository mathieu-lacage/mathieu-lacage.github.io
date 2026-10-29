// Print the deck to PDF: index.html?print-pdf (reveal.js print view, every
// animation in its final state), one 1280 × 720 page per slide.
// usage: node tools/pdf.mjs index.html deck.pdf   (CHROME: path of the browser to drive)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const [src, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(pathToFileURL(path.resolve(src)) + '?print-pdf', { waitUntil: 'networkidle0' });
// reveal.js lays out its print pages after it starts; MathJax typesets asynchronously
await page.waitForSelector('.pdf-page');
await page.evaluate(() => Promise.all([window.MathJax?.startup?.promise, document.fonts.ready]));
await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
await browser.close();
