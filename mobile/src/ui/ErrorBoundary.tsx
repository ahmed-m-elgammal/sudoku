// ErrorBoundary — the last line between a render-time throw and a dead app.
//
// DAY1 integrity fix (store-audit P1): the app shipped with NO error boundary
// anywhere — a single render-time throw (a hostile save, a registry gap, anything)
// unmounted the whole tree, and in a release build that reads as "the app vanished".
// This boundary wraps GameShell inside App.tsx and turns any such throw into a
// themed, recoverable plate.
//
// Scope law (React's, not ours): a boundary catches render-time throws and
// lifecycle errors in the subtree BELOW it. It does not catch event handlers,
// async callbacks, or a failure above it (the font/save boot gates keep their own
// hold views). The fallback is deliberately dumb: one reset that clears the error
// state and remounts GameShell — the screen machine lives in zustand (outside the
// tree), so resuming keeps the player's save and their place.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { i18n } from '@/i18n';
import { fonts, layout, palette, type as typeScale } from '@/theme/tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Best-effort breadcrumb. A release build has no console, but this costs
    // nothing, keeps dev runs honest, and gives EAS build logs a marker.
    console.warn('[assize] a screen tore the page:', error.message, info.componentStack ?? '');
  }

  private resume = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const fs = typeScale(1);
    return (
      <View style={styles.root}>
        <Text style={styles.wordmark}>ASSIZE</Text>
        <Text style={[styles.title, { fontSize: 1.4 * fs.md }]}>{i18n.errorBoundary.title}</Text>
        <Text style={[styles.body, { fontSize: fs.sm }]}>{i18n.errorBoundary.body}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={i18n.errorBoundary.retry}
          onPress={this.resume}
          style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.9 : 1 }]}
        >
          <Text style={[styles.retryText, { fontSize: fs.md }]}>{i18n.errorBoundary.retry}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.inkBlack,
    padding: 24,
  },
  wordmark: {
    color: palette.parchmentLight,
    fontFamily: fonts.display,
    fontSize: 40,
    letterSpacing: 6,
    marginBottom: 26,
  },
  title: {
    color: palette.brassDim,
    fontFamily: fonts.display,
    letterSpacing: 1,
    textAlign: 'center',
  },
  body: {
    color: palette.parchmentDim,
    fontFamily: fonts.body,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 26,
    maxWidth: 460,
    lineHeight: 21,
  },
  retry: {
    minHeight: layout.touch,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: palette.brassDim,
    borderRadius: layout.radius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.charcoal,
  },
  retryText: {
    color: palette.parchmentLight,
    fontFamily: fonts.display,
    letterSpacing: 0.5,
  },
});
