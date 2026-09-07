import type { ImageSource } from 'expo-image';
export type CharacterArt = {body: ImageSource; thumbnail: ImageSource; faces: Record<string, ImageSource>};
export const CHARACTER_ART: Record<string, CharacterArt> = {};
