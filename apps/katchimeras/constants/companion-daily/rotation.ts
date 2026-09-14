import type { CompanionNoticeActivityConfig, CompanionNoticePrompt, CompanionPhotoActivityConfig } from '@/types/companion-daily';

/** A calendar day as a stable index into a rotation. */
function dayIndex(dayId: string): number {
  const day = Math.floor(Date.parse(`${dayId}T12:00:00Z`) / 86400000);
  return Number.isFinite(day) ? day : 0;
}

/** The day's noticing prompt, the same all day and different tomorrow. */
export function noticePromptForDay(notice: CompanionNoticeActivityConfig, dayId: string): CompanionNoticePrompt {
  return notice.prompts[dayIndex(dayId) % notice.prompts.length]!;
}

/** The day's thanks for a matching photo, rotating by day. */
export function photoThanksForDay(photo: CompanionPhotoActivityConfig, dayId: string): string {
  const lines = photo.lines.thanks;
  return lines[dayIndex(dayId) % Math.max(1, lines.length)] ?? lines[0] ?? 'Thank you for showing me.';
}
