import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { recordTravelMemoryLocationObject, TRAVEL_MEMORY_LOCATION_TASK } from '@/utils/travel-memory-mode';

type LocationTaskData = {
  locations?: Location.LocationObject[];
};

if (!TaskManager.isTaskDefined(TRAVEL_MEMORY_LOCATION_TASK)) {
  TaskManager.defineTask<LocationTaskData>(TRAVEL_MEMORY_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = data?.locations ?? [];
    locations.forEach((location) => recordTravelMemoryLocationObject(location));
  });
}
