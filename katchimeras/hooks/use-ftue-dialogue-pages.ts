import { useState } from 'react';
import { ftueDialoguePages } from '@/features/onboarding/ftue-dialogue-pages';

export function useFtueDialoguePages(text: string) {
  const pages = ftueDialoguePages(text);
  const [cursor, setCursor] = useState({ text, index: 0 });
  // Reset synchronously when the speaker moves to a different authored beat.
  const index = cursor.text === text ? Math.min(cursor.index, pages.length - 1) : 0;
  return { text: pages[index], hasNext: index < pages.length - 1,
    next: () => setCursor({ text, index: Math.min(index + 1, pages.length - 1) }) };
}
