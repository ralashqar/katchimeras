import type { ContentCondition, ContentFacts, ContentLine, ContentPredicate, ContentTextSpec, ContentValue } from '@/types/content-predicate';

/**
 * Evaluates conditions and fills lines authored as data. Every caller turns
 * its own context into flat facts once (`{ coins: 12, 'theory.friction':
 * 'starting', 'answer.tiny.pace': 'rush' }`), then conditions read them by
 * name and lines fill `{{token}}` placeholders from them.
 *
 * Placeholders: `{{name}}` (numbers are written with locale grouping),
 * `{{name|raw}}` (as is), `{{name|cap:500}}` (no higher than), and
 * `{{name|plural:step,steps}}` (the word for the number). A token nobody
 * provided renders empty, never `undefined`.
 */
function present(value: ContentValue | undefined): boolean {
  return value != null && value !== '' && value !== false;
}

export function evaluateCondition(condition: ContentCondition, facts: ContentFacts): boolean {
  if ('all' in condition) return condition.all.every((entry) => evaluateCondition(entry, facts));
  if ('any' in condition) return condition.any.some((entry) => evaluateCondition(entry, facts));
  if ('not' in condition) return !evaluateCondition(condition.not, facts);
  const name = 'fact' in condition ? condition.fact : `answer.${condition.answer}`;
  const value = facts[name];
  if (condition.exists != null && present(value) !== condition.exists) return false;
  if (condition.eq !== undefined && value !== condition.eq) return false;
  if (condition.ne !== undefined && value === condition.ne) return false;
  if (condition.in && !(condition.in as readonly (ContentValue | undefined)[]).includes(value)) return false;
  if ('fact' in condition) {
    const number = typeof value === 'number' ? value : Number.NaN;
    if (condition.gt != null && !(number > condition.gt)) return false;
    if (condition.gte != null && !(number >= condition.gte)) return false;
    if (condition.lt != null && !(number < condition.lt)) return false;
    if (condition.lte != null && !(number <= condition.lte)) return false;
  }
  return true;
}

/** A predicate as data or code: data reads the facts, code its own context. Code that throws says no. */
export function resolvePredicate<Context>(predicate: ContentPredicate<Context>, context: Context, facts: () => ContentFacts): boolean {
  if (typeof predicate === 'function') {
    try { return predicate(context); } catch { return false; }
  }
  return evaluateCondition(predicate, facts());
}

function format(value: ContentValue | undefined, filters: readonly string[]): string {
  let current: ContentValue | undefined = value;
  let raw = false;
  for (const filter of filters) {
    const [name, argument = ''] = filter.split(':', 2) as [string, string?];
    if (name === 'raw') raw = true;
    else if (name === 'cap' && typeof current === 'number') current = Math.min(current, Number(argument));
    else if (name === 'plural') {
      const [one = '', many = one] = argument.split(',');
      return typeof current === 'number' && current === 1 ? one : many;
    }
  }
  if (current == null || current === false) return '';
  if (typeof current === 'number') return raw ? String(current) : current.toLocaleString();
  return String(current);
}

export function fillTemplate(text: string, facts: ContentFacts): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, inner: string) => {
    const [name, ...filters] = inner.split('|').map((part) => part.trim());
    return format(facts[name!], filters);
  });
}

/** A line as data: the first variant whose condition holds, else the base text, filled from the facts. */
export function renderContentText(spec: ContentTextSpec, facts: ContentFacts): string {
  if (typeof spec === 'string') return fillTemplate(spec, facts);
  const variant = spec.variants?.find((candidate) => evaluateCondition(candidate.when, facts));
  return fillTemplate(variant?.text ?? spec.text, facts);
}

/** A line as data or code: data is rendered from the facts, code is called with its own context. */
export function resolveContentLine<Context>(line: ContentLine<Context>, context: Context, facts: () => ContentFacts): string {
  if (typeof line === 'function') return line(context);
  return renderContentText(line, facts());
}

/** True when a line or predicate is data a content pack could carry. */
export function isContentData(value: unknown): boolean {
  return typeof value !== 'function';
}
