import { normalizeSpeechText } from '@/utils/speech-text';

/** Keep authored FTUE speech readable in the existing compact bubble. */
export const FTUE_DIALOGUE_MAX_CHARACTERS = 120;
export function ftueDialoguePages(text: string): string[] {
  const pages: string[] = [];
  let page = '';
  for (const sentence of normalizeSpeechText(text).match(/[^.!?]+[.!?]?/g) ?? []) {
    const words = sentence.trim().split(/\s+/).flatMap((word) => word.match(/.{1,120}/gu) ?? []);
    const whole = words.join(' ');
    if (page && whole.length <= FTUE_DIALOGUE_MAX_CHARACTERS && page.length + whole.length + 1 > FTUE_DIALOGUE_MAX_CHARACTERS) {
      pages.push(page); page = '';
    }
    for (const word of words) {
      if (page && page.length + word.length + 1 > FTUE_DIALOGUE_MAX_CHARACTERS) { pages.push(page); page = ''; }
      page = page ? `${page} ${word}` : word;
    }
  }
  if (page) pages.push(page);
  return pages.length ? pages : [''];
}
