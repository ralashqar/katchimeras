// One-shot signal: Today's "keepsakes waiting" chip asks the Kingdom to open
// the keepsakes shelf when it next gains focus (same consume-on-focus pattern
// as capture-feed-signal / selected-day-signal).

let pending = false;

export function requestKeepsakesShelf() {
  pending = true;
}

export function consumeKeepsakesShelfRequest(): boolean {
  const value = pending;
  pending = false;
  return value;
}
