import { openDatabaseAsync } from "expo-sqlite";
import { createContentFlowRepository } from "@incubator/story-expo/repository";
export const storyRepository = createContentFlowRepository(
  "egg-snap-story.db",
  openDatabaseAsync,
);
