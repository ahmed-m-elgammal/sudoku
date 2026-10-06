// FolioMap - PHASE A STUB.
//
// OWNED BY: screens agent (A4)
// Port ../src/app/game/FolioMap.tsx
//
// The real implementation replaces this file entirely. This stub only exists so
// Phase A compiles and the app boots to a live screen. Do not treat it as a design
// to follow - port the web build's component, not this placeholder.
import { View, Text, StyleSheet } from 'react-native';
import { palette, type as typeScale } from '@/theme/tokens';

export default function FolioMap() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>FolioMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.inkBlack },
  label: { color: palette.parchmentDim, fontSize: typeScale(1).sm, fontFamily: 'Georgia', letterSpacing: 2 },
});