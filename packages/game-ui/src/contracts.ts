import type { ComponentType } from 'react';
import type { TextProps, StyleProp, TextStyle } from 'react-native';
import type { GameTheme } from './theme';
export type UIAdapters<Icon extends string> = {
GameUI: GameTheme;
ThemedText: ComponentType<TextProps & {lightColor?:string;darkColor?:string}>;
IconSymbol: ComponentType<{name:Icon;color:string;size?:number;style?:StyleProp<TextStyle>}>;
};
