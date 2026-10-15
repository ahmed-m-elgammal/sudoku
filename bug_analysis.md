# Tutorial `roundRect` Crash — Root Cause Analysis

## The Error

```
ERROR  [ReferenceError: Property 'roundRect' doesn't exist]
WARN  [assize] a screen tore the page … repeatedly calls setState inside componentWillUpdate
```

## Root Cause: Infinite `setState` Loop from `measureInWindow`

The crash has **two interacting bugs** in [TutorialLayer.tsx](file:///c:/Users/A-Dev/Downloads/sudokou%20game/mobile/src/ui/duel/tutorial/TutorialLayer.tsx):

### Bug 1 — `measureInWindow` can pass `undefined` values on Android

On Android (Hermes), `measureInWindow` can fire its callback with `undefined` arguments when the View hasn't been laid out yet or has been detached. The callback at **line 82–85**:

```ts
ref.current?.measureInWindow((x, y, w, h) => {
  const r = roundRect(x, y, w, h);       // roundRect(undefined, undefined, …)
  set((prev) => (sameRect(prev, r) ? prev : r));
});
```

When `x, y, w, h` are `undefined`:
- `roundRect()` returns `{ x: NaN, y: NaN, w: NaN, h: NaN }`
- `sameRect()` compares `NaN === NaN` → always **`false`**
- So `set()` **always fires**, causing a re-render
- The re-render triggers the effect again → **infinite loop**

### Bug 2 — The infinite loop eventually exhausts the call stack

The infinite `setState` storm (measure → set → render → measure → set → …) starves React's scheduling. Eventually the Hermes engine throws:

```
ReferenceError: Property 'roundRect' doesn't exist
```

This is Hermes's way of saying a property access failed during the stack overflow — the module's exports become inaccessible as the stack unwinds. The `componentWillUpdate` warning is React 19's internal detection of the runaway re-render cycle.

## Evidence

| Clue | Points to |
|---|---|
| `sameRect` uses strict `===` | `NaN !== NaN` breaks the guard |
| Error is `ReferenceError` not `TypeError` | Stack exhaustion corrupts module scope in Hermes |
| `componentWillUpdate` setState warning | Infinite re-render loop detected by React |
| Only crashes in tutorial | `measureInWindow` is only called in `TutorialLayer` |
| The app renders briefly before crashing | The first few renders work; the loop takes a moment to exhaust |

## The Fix

**Guard the `measureInWindow` callback** against `undefined`/`NaN` values, and add a `NaN`-safe check in `sameRect`:

### Fix 1: Guard `measureInWindow` callback in TutorialLayer.tsx (line 82)

```diff
 ref.current?.measureInWindow((x, y, w, h) => {
+  if (x == null || y == null || w == null || h == null) return;
   const r = roundRect(x, y, w, h);
   set((prev) => (sameRect(prev, r) ? prev : r));
 });
```

### Fix 2: Make `sameRect` NaN-safe in spotlight.ts (line 53)

```diff
 export function sameRect(a: Rect, b: Rect): boolean {
-  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
+  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h
+    && !Number.isNaN(a.x) && !Number.isNaN(a.y);
 }
```

> [!TIP]
> Fix 1 is the primary fix (stops the loop at the source). Fix 2 is a safety net so `sameRect` never lies about equality when NaN is involved.
