// ASSIZE mobile — ambient asset modules.
//
// Metro bundles binary assets and hands the import back as its asset module id;
// the logic-test runner hands back a file reference. Both are opaque to this code,
// so the type is the honest "opaque asset" — a number under Metro, where
// expo-audio's AudioSource accepts it directly.

declare module '*.wav' {
  const asset: number;
  export default asset;
}
