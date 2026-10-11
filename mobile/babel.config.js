// ASSIZE mobile — Babel config.
//
// One thing matters here: `babel-preset-expo`, the Expo/React Native transform.
//
// B1 (pre-launch audit) — `react-native-worklets/plugin` used to sit here as the
// mandatory companion of a Reanimated 4 that AGENTS.md mandated but the code never
// used (every animation is RN's built-in `Animated`, by design — see fx.ts and
// Cell.tsx). The two packages cost several MB of dead native libs in every install
// and every build. They are gone: the plugin goes with them. If Reanimated is ever
// adopted deliberately (post-launch), re-add both dependencies and re-add
// `react-native-worklets/plugin` LAST in this list — babel-preset-expo also
// auto-applies it in SDK 57 when it detects the packages in package.json.

module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [],
  };
};
