// ASSIZE asset generator (spec §9 pipeline A + C).
//   bun tools/generate-assets.mjs                 -> everything missing
//   bun tools/generate-assets.mjs --raster-only   -> only imagegen assets (pipeline A)
//   bun tools/generate-assets.mjs --procedural-only
//   bun tools/generate-assets.mjs --force
// Idempotent: skips assets whose primary file already exists (unless --force).
import fs from 'node:fs';
import path from 'node:path';
import { ALL } from './asset-data.mjs';
import { FACTORIES } from './svg-factories.mjs';
import { mulberry32, hashSeed } from './svg-lib.mjs';

const ROOT = path.resolve(import.meta.dir, '..');
const PUB = path.join(ROOT, 'public/assets');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const RASTER_ONLY = args.includes('--raster-only');
const PROC_ONLY = args.includes('--procedural-only');
const CONC = 1;

const manifestPath = path.join(ROOT, 'assets/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const byId = Object.fromEntries(manifest.assets.map((a) => [a.id, a]));

// ------------------------------------------------------------- procedural
function runProcedural() {
  let n = 0;
  for (const a of ALL) {
    if (a.pipeline !== 'procedural') continue;
    const outFile = path.join(PUB, a.dir, a.out[0].file);
    if (fs.existsSync(outFile) && !FORCE) continue;
    const factory = FACTORIES[a.factory];
    if (!factory) throw new Error(`no factory ${a.factory} for ${a.id}`);
    const rnd = mulberry32(hashSeed(a.id));
    const svg = factory(rnd, a);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, svg);
    const m = byId[a.id];
    m.status = 'procedural';
    m.bytes = Buffer.byteLength(svg);
    m.generatedAt = new Date().toISOString();
    n++;
  }
  save(`procedural: ${n} written`);
}

// ------------------------------------------------------------- raster (pipeline A)
async function genOne(zai, sharp, a) {
  const dir = path.join(PUB, a.dir);
  fs.mkdirSync(dir, { recursive: true });
  const master = path.join(dir, '_master-' + a.id + '.png');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await zai.images.generations.create({ prompt: a.prompt, size: a.genSize });
      const b64 = res?.data?.[0]?.base64;
      if (!b64) throw new Error('empty base64');
      fs.writeFileSync(master, Buffer.from(b64, 'base64'));
      for (const o of a.out) {
        const fp = path.join(dir, o.file);
        await sharp(master).resize(o.width, o.height, { fit: 'cover', position: 'centre' }).toFile(fp);
      }
      fs.rmSync(master, { force: true });
      const m = byId[a.id];
      m.status = 'generated';
      m.bytes = fs.statSync(path.join(dir, a.out.find((o) => o.primary).file)).size;
      m.generatedAt = new Date().toISOString();
      return true;
    } catch (e) {
      console.error(`  ${a.id} attempt ${attempt} failed: ${e.message}`);
      if (attempt === 5) { byId[a.id].status = 'placeholder'; return false; }
      await new Promise((r) => setTimeout(r, (e.message.includes('429') ? 20000 : 4000) * attempt));
    }
  }
}

async function runRaster() {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
  const { default: sharp } = await import('sharp');
  const zai = await ZAI.create();
  const todo = ALL.filter((a) => {
    if (a.pipeline !== 'imagegen') return false;
    const primary = path.join(PUB, a.dir, a.out.find((o) => o.primary).file);
    return FORCE || !fs.existsSync(primary);
  });
  console.log(`raster: ${todo.length} to generate`);
  let done = 0, failed = 0;
  const queue = [...todo];
  async function worker() {
    while (queue.length) {
      const a = queue.shift();
      const ok = await genOne(zai, sharp, a);
      ok ? done++ : failed++;
      console.log(`  [${done + failed}/${todo.length}] ${a.id} ${ok ? 'OK' : 'FAILED'}`);
      save(`progress ${done + failed}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  save(`raster: ${done} generated, ${failed} failed`);
}

function save(note) {
  manifest.generated = new Date().toISOString();
  manifest.note = note;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

(async () => {
  if (!PROC_ONLY) await runRaster();
  if (!RASTER_ONLY) runProcedural();
  const pend = manifest.assets.filter((a) => a.status === 'pending').length;
  console.log(`done. pending: ${pend}`);
})();
