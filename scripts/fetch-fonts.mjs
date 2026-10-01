// Download self-hosted WOFF2 fonts (spec §9: IM Fell English SC, IM Fell DW Pica, Libre Caslon Text 600).
import fs from 'node:fs';
import path from 'node:path';

const FONTS = [
  ['im-fell-english-sc', 'IM+Fell+English+SC', '400'],
  ['im-fell-dw-pica', 'IM+Fell+DW+Pica', '400'],
  ['im-fell-dw-pica-italic', 'IM+Fell+DW+Pica:ital@1', '400'],
  ['libre-caslon-600', 'Libre+Caslon+Text:wght@600', '600'],
  ['libre-caslon-400', 'Libre+Caslon+Text', '400'],
];
const out = path.resolve(import.meta.dir, '../public/fonts');
fs.mkdirSync(out, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
for (const [name, family] of FONTS) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}&display=swap`, { headers: { 'User-Agent': UA } })).text();
    const m = css.match(/src:\s*url\((https:[^)]+\.woff2)\)/);
    if (!m) { console.error(`${name}: no woff2 found`); continue; }
    const buf = Buffer.from(await (await fetch(m[1], { headers: { 'User-Agent': UA } })).arrayBuffer());
    fs.writeFileSync(path.join(out, `${name}.woff2`), buf);
    console.log(`${name}: ${buf.length} bytes`);
  } catch (e) { console.error(`${name} FAILED: ${e.message}`); }
}
