import type { ContentFlowRun } from "@incubator/story/types";
export const storyRepository = {
  async loadContentFlowRun(id: string): Promise<ContentFlowRun | null> {
    const v = localStorage.getItem(`egg-snap-story:${id}`);
    return v ? JSON.parse(v) : null;
  },
  async saveContentFlowTransition(run: ContentFlowRun) {
    localStorage.setItem(`egg-snap-story:${run.runId}`, JSON.stringify(run));
  },
};
