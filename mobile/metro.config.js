// ASSIZE mobile — Metro config.
//
// One job: teach Metro about the `@shared/*` path alias.
//
// `shared/` is the engine. It lives at the REPO ROOT (`../shared`), outside this
// project, and it is consumed by BOTH the legacy Next.js PWA and this app. It is
// never copied — one engine, two consumers, drift impossible (risk R8 in specs/14).
//
// The same alias is declared in three places, and all three must agree:
//   - tsconfig.json  `paths`      → for `tsc --noEmit`
//   - vitest.config.ts `resolve.alias` → for the test runner
//   - HERE           `extraNodeModules` + `watchFolders` → for Metro (the bundler)
//
// Without this file `expo export` / `expo start` cannot resolve `@shared/engine`
// and the app fails to bundle at all.

const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', 'shared');

const config = getDefaultConfig(projectRoot);

// Metro must WATCH the shared engine: it lives outside the project root, so edits to
// ../shared/*.ts would otherwise not trigger a rebuild.
config.watchFolders = [...(config.watchFolders ?? []), sharedRoot];

// `@shared`      -> <repo>/shared          (the barrel, shared/index.ts)
// `@shared/foo`  -> <repo>/shared/foo.ts    (the engine modules)
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@shared': sharedRoot,
};

// Block Metro from resolving a SECOND copy of a dependency that exists both in
// mobile/node_modules and at the repo root — a duplicate React would break hooks.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// ---- SVG / raster twins: bundle them as ASSETS.
//
// The engraved kit ships as RASTER TWINS (png/webp) baked from the kit's SVG sources
// by `tools/rasterize-game-art.mjs` — react-native-svg does not implement the kit's
// feTurbulence/feDisplacementMap filters, and runtime XML parsing per mount was the
// measured 0 fps + warning source (docs/ship-gates-phase6.md, the follow-up section).
// Screens render the twins through `src/ui/Art.tsx` (a native <Image>); the .svg
// sources stay in the tree unbundled. Keeping `svg` in `assetExts` means a stray
// `require('./x.svg')` still resolves to an asset instead of crashing the bundler.
if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts = [...config.resolver.assetExts, 'svg'];
}

module.exports = config;