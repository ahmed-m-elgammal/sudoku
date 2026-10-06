// ASSIZE mobile — Babel config.
//
// Two things matter here:
//
//  1. `babel-preset-expo` — the Expo/React Native transform.
//  2. `react-native-worklets/plugin` — MANDATORY for Reanimated 4.
//
// Reanimated 4 delegates its worklets to the separate `react-native-worklets` package,
// and the Babel plugin that rewrites `'worklet'` functions lives in THAT package, not in
// reanimated. Without this plugin the app still bundles, but every Reanimated animation
// silently fails at runtime — `useAnimatedStyle` returns a static style and the ink flood,
// screen shake and hit-stop all go dead (risk R3 in specs/14).
//
// The plugin must be LAST in the plugins list.
//
// (Note: `babel-preset-expo` auto-applies this plugin in SDK 57 when it detects
// reanimated/worklets in package.json. It is declared explicitly here anyway so the
// requirement is visible at the point of failure rather than implied.)

module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};