import { createCinematicEnvironment } from '@incubator/environments/cinematic';
import type { TodayExplorationBackgroundKey } from '@/utils/today-exploration-backgrounds';
import todayScene from '@/data/today-scene.json';
import { TODAY_EXPLORATION_BACKGROUND_SOURCES } from '@/constants/today-exploration-background-sources.gen';
import { EXPLORATION_ENVIRONMENT_PROGRESSION_SOURCES } from '@/constants/exploration-environment-progression-sources';
export const { useTodayExplorationBackgroundMotion, TodayExplorationBackground, TodayExplorationPageLayer, TodayExplorationSceneLayer } = createCinematicEnvironment<TodayExplorationBackgroundKey>({todayScene, backgrounds:TODAY_EXPLORATION_BACKGROUND_SOURCES, progressions:EXPLORATION_ENVIRONMENT_PROGRESSION_SOURCES});
