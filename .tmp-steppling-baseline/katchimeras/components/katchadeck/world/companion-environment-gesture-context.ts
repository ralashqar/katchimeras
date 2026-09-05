import { createContext } from 'react';
import type { GestureType } from 'react-native-gesture-handler';

/** Nested controls can claim their gesture before the page-wide swipe-to-exit. */
export const CompanionEnvironmentGestureContext = createContext<GestureType | undefined>(undefined);
