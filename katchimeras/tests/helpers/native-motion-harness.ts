// Deterministic UI-thread clock around real React renders. Native drawing is
// intentionally not simulated; tests exercise mount ownership and callbacks.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import React from 'react';
import ts from 'typescript';

type Motion = { kind: 'timing'; to: number; duration: number; easing: (x: number) => number; done?: (finished: boolean) => void }
  | { kind: 'delay'; delay: number; child: Motion }
  | { kind: 'sequence'; children: Motion[] };
type Value = { value: number; current: number; animation?: { start: number; from: number; motion: Motion } };
const duration = (m: Motion): number => m.kind === 'timing' ? m.duration : m.kind === 'delay' ? m.delay + duration(m.child) : m.children.reduce((total, child) => total + duration(child), 0);
function sample(m: Motion, elapsed: number, from: number): number {
  if (elapsed < 0) return from;
  if (m.kind === 'timing') return from + (m.to - from) * m.easing(Math.min(1, elapsed / m.duration));
  if (m.kind === 'delay') return sample(m.child, elapsed - m.delay, from);
  for (const child of m.children) {
    if (elapsed < duration(child)) return sample(child, elapsed, from);
    from = sample(child, duration(child), from);
    elapsed -= duration(child);
  }
  return from;
}
function complete(m: Motion) {
  if (m.kind === 'timing') m.done?.(true);
  else if (m.kind === 'delay') complete(m.child);
  else m.children.forEach(complete);
}

export function nativeMotionHarness() {
  let now = 0;
  const values = new Set<Value>();
  const builder = { delay: () => builder, duration: () => builder, easing: () => builder };
  const animated = {
    __esModule: true,
    default: { View: 'AnimatedView' },
    Easing: {
      cubic: (x: number) => x ** 3,
      quad: (x: number) => x ** 2,
      in: (fn: (x: number) => number) => fn,
      out: (fn: (x: number) => number) => (x: number) => 1 - fn(1 - x),
      inOut: (fn: (x: number) => number) => (x: number) => x < 0.5 ? fn(x * 2) / 2 : 1 - fn((1 - x) * 2) / 2,
    },
    FadeIn: builder, FadeInDown: builder, FadeInUp: builder,
    useReducedMotion: () => false,
    useSharedValue: (initial: number) => {
      const ref = React.useRef<Value | null>(null);
      if (!ref.current) {
        const value = { current: initial } as Value;
        Object.defineProperty(value, 'value', {
          get: () => value.current,
          set: (next: number | Motion) => {
            if (typeof next === 'number') { value.current = next; value.animation = undefined; }
            else value.animation = { start: now, from: value.current, motion: next };
          },
        });
        values.add(value);
        ref.current = value;
      }
      return ref.current;
    },
    useAnimatedStyle: (read: () => object) => ({ read }),
    withTiming: (to: number, options: { duration: number; easing?: (x: number) => number }, done?: (finished: boolean) => void): Motion => ({ kind: 'timing', to, ...options, easing: options.easing ?? ((x) => x), done }),
    withDelay: (delay: number, child: Motion): Motion => ({ kind: 'delay', delay, child }),
    withSequence: (...children: Motion[]): Motion => ({ kind: 'sequence', children }),
    cancelAnimation: (value: Value) => { value.animation = undefined; },
    runOnJS: (fn: Function) => fn,
  };
  return {
    animated,
    advance(ms: number) {
      now += ms;
      const callbacks: Motion[] = [];
      values.forEach((value) => {
        const animation = value.animation;
        if (!animation) return;
        const elapsed = now - animation.start;
        value.current = sample(animation.motion, elapsed, animation.from);
        if (elapsed >= duration(animation.motion)) {
          value.animation = undefined;
          callbacks.push(animation.motion);
        }
      });
      callbacks.forEach(complete);
    },
  };
}

const requireFromTest = createRequire(import.meta.url);
export function loadNativeModule(path: string, mocks: Record<string, unknown>, globals: Record<string, unknown> = {}, declaration?: string) {
  let source = readFileSync(path, 'utf8');
  if (declaration) {
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const statement = file.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((decl) => decl.name.getText(file) === declaration));
    if (!statement) throw new Error(`Missing ${declaration}`);
    source = `${statement.getText(file)}\nexports.${declaration} = ${declaration};`;
  }
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as Record<string, Function> };
  runInNewContext(code, {
    ...globals, module, exports: module.exports, console,
    require: (id: string) => id in mocks ? mocks[id] : requireFromTest(id),
  });
  return module.exports;
}

export const nativeViews = { View: 'View', StyleSheet: { absoluteFill: {}, create: (styles: object) => styles }, useWindowDimensions: () => ({ width: 400, height: 800 }) };


export function loadCompanionOverlay(clock = nativeMotionHarness(), reducedMotion = true) {
  const animated = { ...clock.animated, useReducedMotion: () => reducedMotion };
  const slide = loadNativeModule('hooks/use-companion-action-slide.ts', {
    'react-native': nativeViews, 'react-native-reanimated': animated,
  });
  return loadNativeModule('components/katchadeck/world/companion-scene-overlay.tsx', {
    'react-native': nativeViews, 'react-native-reanimated': animated,
    '@/hooks/use-companion-action-slide': slide,
    '@/hooks/use-companion-stack-layout': loadNativeModule('hooks/use-companion-stack-layout.ts', { 'react-native-reanimated': animated }),
  });
}
