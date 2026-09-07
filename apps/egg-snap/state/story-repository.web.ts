import { createKeyValueStoryRepository } from '@incubator/story-expo/key-value-repository';
import type { ContentFlowRun } from '@incubator/story/types';
export const storyRepository = createKeyValueStoryRepository({
  read: () => {
    const saved = localStorage.getItem('egg-snap-story-journal-v2');
    if (saved !== null) return saved;
    const runs: Record<string, ContentFlowRun> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('egg-snap-story:')) continue;
      const run = JSON.parse(localStorage.getItem(key)!);
      if (!run.runId || run.schemaVersion !== 1) throw new Error('Invalid saved conversation');
      runs[run.runId] = { ...run, revision: run.revision ?? 0 };
    }
    return JSON.stringify({ runs, events: [] });
  },
  write: value => localStorage.setItem('egg-snap-story-journal-v2', value),
});
