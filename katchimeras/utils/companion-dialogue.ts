function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Dialogue bubbles belong to the visible companion. Repair only explicit
 * third-person grammar; a broad name replacement would corrupt valid lines
 * such as “I’m Snuglet” into “I’m I”.
 */
export function companionFirstPersonText(value: string, companionName: string): string {
  if (!value || !companionName) return value;
  const name = escapeRegExp(companionName);
  return value
    .replace(new RegExp(`\\b${name}[’']s\\b`, 'gi'), 'my')
    .replace(new RegExp(`\\bhelp ${name} understand\\b`, 'gi'), 'help me understand')
    .replace(new RegExp(`\\bhow should ${name} use\\b`, 'gi'), 'How should I use')
    .replace(new RegExp(`\\b${name} will\\b`, 'gi'), 'I’ll')
    .replace(new RegExp(`\\b${name} can\\b`, 'gi'), 'I can')
    .replace(new RegExp(`\\b${name} to\\b`, 'gi'), 'me to')
    .replace(new RegExp(`\\bwith ${name}\\b`, 'gi'), 'with me')
    .replace(new RegExp(`\\bfor ${name}\\b`, 'gi'), 'for me');
}

export function companionFormGreeting(companionName: string): string {
  return `I’m ${companionName} today—our bond and everything I remember are still here.`;
}
