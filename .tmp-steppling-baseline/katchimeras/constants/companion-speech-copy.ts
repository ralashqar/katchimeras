/** Authoring limits for text shown together inside a companion speech bubble. */
export const COMPANION_SPEECH_COPY_LIMITS = {
  prompt: 80,
  helperText: 120,
  combined: 170,
} as const;

export function companionSpeechCopyIssues(
  id: string,
  prompt: string,
  helperText: string,
): string[] {
  const issues: string[] = [];
  if (prompt.length > COMPANION_SPEECH_COPY_LIMITS.prompt) {
    issues.push(`${id}: speech-bubble prompt exceeds ${COMPANION_SPEECH_COPY_LIMITS.prompt} characters`);
  }
  if (helperText.length > COMPANION_SPEECH_COPY_LIMITS.helperText) {
    issues.push(`${id}: speech-bubble helper exceeds ${COMPANION_SPEECH_COPY_LIMITS.helperText} characters`);
  }
  if (prompt.length + helperText.length > COMPANION_SPEECH_COPY_LIMITS.combined) {
    issues.push(`${id}: combined speech-bubble copy exceeds ${COMPANION_SPEECH_COPY_LIMITS.combined} characters`);
  }
  return issues;
}
