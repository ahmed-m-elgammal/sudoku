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

// ---- SVG: bundle it as an ASSET.
//
// The duel UI is 210 procedural engraved SVGs (seals, sigils, board furniture, status
// overlays, the num-tile and medallion chrome). React Native cannot `require()` an
// `.svg` the way it can a `.png` — Metro would hand the raw markup to the JS parser.
//
// Adding `svg` to `assetExts` makes Metro treat it as a bundled file, so
// `require('./foo.svg')` returns a resolved URI that react-native-svg's <SvgUri> can
// render. This is the zero-dependency route: the alternative is
// `react-native-svg-transformer` (a babel plugin + a new package), which is not needed
// because every SVG here is used as a texture/mark, never as composed JSX.
//
// Note: this also fixes a latent bug — `theme/assets.ts` already `require()`d
// `brand/wordmark.svg`, which could not have resolved before this line.
if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts = [...config.resolver.assetExts, 'svg'];
}

module.exports = config;