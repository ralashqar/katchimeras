// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left': 'chevron-left',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'arrow.right': 'arrow-forward',
  'star.fill': 'star',
  'sparkles': 'auto-awesome',
  'arrow.counterclockwise': 'refresh',
  'xmark': 'close',
  'figure.walk': 'directions-walk',
  'mappin.and.ellipse': 'location-on',
  'bolt.fill': 'bolt',
  'cup.and.saucer.fill': 'local-cafe',
  'moon.stars.fill': 'dark-mode',
  'heart.fill': 'favorite',
  'camera.fill': 'photo-camera',
  'bubble.left.and.bubble.right.fill': 'forum',
  'sun.max.fill': 'wb-sunny',
  'cloud.sun.fill': 'wb-cloudy',
  'cloud.fill': 'cloud',
  'cloud.fog.fill': 'foggy',
  'cloud.rain.fill': 'water-drop',
  'cloud.snow.fill': 'ac-unit',
  'cloud.bolt.rain.fill': 'thunderstorm',
  'fork.knife': 'restaurant',
  'leaf.fill': 'park',
  'building.columns.fill': 'museum',
  'water.waves': 'waves',
  'figure.run': 'directions-run',
  'pawprint.fill': 'pets',
  'person.2.fill': 'people',
  'building.2.fill': 'location-city',
  'party.popper.fill': 'celebration',
  'paintbrush.fill': 'spa',
  'camera.viewfinder': 'photo-camera',
  // Daylio-style "add to today" inputs (mood / sleep / activity / hobby).
  'film.fill': 'movie',
  'book.fill': 'menu-book',
  'music.note': 'music-note',
  'gamecontroller.fill': 'sports-esports',
  'bed.double.fill': 'bed',
  'dumbbell.fill': 'fitness-center',
  'face.smiling': 'mood',
  'briefcase.fill': 'work',
  'cart.fill': 'shopping-cart',
  'fork.knife.circle.fill': 'restaurant',
  'globe.americas.fill': 'public',
  'scope': 'center-focus-strong',
  'timer': 'timer',
  'mic.fill': 'mic',
  'square.and.pencil': 'edit',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
