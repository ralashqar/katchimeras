// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
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
  'calendar': 'calendar-month',
  'arrow.right': 'arrow-forward',
  'star.fill': 'star',
  'sparkles': 'auto-awesome',
  'arrow.counterclockwise': 'refresh',
  'rectangle.portrait.and.arrow.right': 'flip',
  'xmark': 'close',
  'figure.walk': 'directions-walk',
  'mappin.and.ellipse': 'location-on',
  'map.fill': 'map',
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
  'tv.fill': 'tv',
  'play.rectangle.fill': 'smart-display',
  'sportscourt.fill': 'sports-soccer',
  'newspaper.fill': 'newspaper',
  'book.fill': 'menu-book',
  'music.note': 'music-note',
  'speaker.wave.2.fill': 'volume-up',
  'speaker.slash.fill': 'volume-off',
  'gamecontroller.fill': 'sports-esports',
  'bed.double.fill': 'bed',
  'dumbbell.fill': 'fitness-center',
  'face.smiling': 'mood',
  'face.very_happy': 'sentiment-very-satisfied',
  'face.happy': 'sentiment-satisfied',
  'face.neutral': 'sentiment-neutral',
  'face.sad': 'sentiment-dissatisfied',
  'face.very_sad': 'sentiment-very-dissatisfied',
  'briefcase.fill': 'work',
  'cart.fill': 'shopping-cart',
  'fork.knife.circle.fill': 'restaurant',
  'globe.americas.fill': 'public',
  'scope': 'center-focus-strong',
  'timer': 'timer',
  'mic.fill': 'mic',
  'square.and.pencil': 'edit',
  'text.quote': 'format-quote',
  'clock': 'schedule',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'plus': 'add',
  'checkmark': 'check',
  'gearshape.fill': 'settings',
  'pencil': 'edit',
  'trash.fill': 'delete',
  'diamond.fill': 'diamond',
  'flame.fill': 'local-fire-department',
  'chevron.down': 'keyboard-arrow-down',
  'book.closed.fill': 'auto-stories',
  'exclamationmark.triangle.fill': 'warning',
  'circle.fill': 'circle',
  'circle.grid.2x2.fill': 'apps',
  'triangle.fill': 'change-history',
  'square.fill': 'square',
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
