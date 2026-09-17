/** Event scenes own progression/rewards in the world transaction, not the daily action deck. */
export function isWorldEventConversation(id: string): boolean {
  return id.startsWith('world-event:');
}
export function isWorldEventDailyAction(id: string): boolean {
  return id.startsWith('mossprout:conversation:world-event:');
}
