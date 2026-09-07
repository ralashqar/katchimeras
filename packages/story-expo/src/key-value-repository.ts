import type { ContentFlowEvent, ContentFlowRun } from '@incubator/story/types';

/** One value contains runs and event receipts, matching SQLite's atomic boundary. */
export function createKeyValueStoryRepository(storage: { read(): string | null; write(value: string): void }) {
  type Journal = { runs: Record<string, ContentFlowRun>; events: string[] };
  const read = (): Journal => JSON.parse(storage.read() ?? '{"runs":{},"events":[]}');
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  function commit<T>(change: (journal: Journal) => T): Promise<T> {
    const result = queue.then(() => {
      const journal = read();
      const output = change(journal);
      storage.write(JSON.stringify(journal));
      listeners.forEach(listener => listener());
      return output;
    });
    queue = result.catch(() => {});
    return result;
  }
  return {
    async loadContentFlowRun(id: string) { await queue; return read().runs[id] ?? null; },
    async listContentFlowRuns(options?: { activeOnly?: boolean }) { await queue; return Object.values(read().runs).filter(r => !options?.activeOnly || r.status === 'active'); },
    async saveContentFlowTransition(run: ContentFlowRun, event?: ContentFlowEvent) {
      await commit(j => { j.runs[run.runId] = run; if (event && !j.events.includes(event.eventId)) j.events.push(event.eventId); });
    },
    reduceContentFlowRunAtomically(input: { runId: string; event?: ContentFlowEvent; reduce: (run: ContentFlowRun) => ContentFlowRun }) {
      return commit(j => {
        const current = j.runs[input.runId];
        if (!current) return { run: null, eventRecorded: false };
        if (input.event && j.events.includes(input.event.eventId)) return { run: current, eventRecorded: false };
        const reduced = input.reduce(current);
        const next = reduced === current ? current : { ...reduced, revision: current.revision + 1 };
        j.runs[input.runId] = next;
        if (input.event) j.events.push(input.event.eventId);
        return { run: next, eventRecorded: !!input.event };
      });
    },
    async contentFlowEventWasRecorded(id: string) { await queue; return read().events.includes(id); },
    async resetContentFlowJournalForDebug() { await commit(j => { j.runs = {}; j.events = []; }); },
    async captureContentFlowJournal() { await queue; return { schemaVersion: 1 as const, runs: Object.values(read().runs) }; },
    async installContentFlowJournalForDebug(input: { schemaVersion: 1; runs: readonly ContentFlowRun[] }) {
      await commit(j => { j.runs = Object.fromEntries(input.runs.map(run => [run.runId, run])); j.events = []; });
    },
    async flushContentFlowJournal() { await queue; },
    subscribeContentFlowJournal(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
