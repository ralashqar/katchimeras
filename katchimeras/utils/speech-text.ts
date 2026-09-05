/** Speech is a continuous paragraph; layout supplies natural wrapping.
 * Inline emphasis fragments retain their boundary spaces.
 */
export function normalizeSpeechText(text: string | undefined, trim = true): string {
  const normalized = (text ?? '').replace(/\s+/gu, ' ');
  return trim ? normalized.trim() : normalized;
}
