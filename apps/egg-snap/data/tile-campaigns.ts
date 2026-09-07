/** Campaign policy only; placement and artwork belong to the shared Mossprout scene. */
export const TILE_CAMPAIGNS = [
  { id: 'nest', slot: 'home', name: 'Pip’s Clearing', levels: ['glade-1', 'glade-2', 'glade-3'], cost: 0 },
  { id: 'trail', slot: 'gate', name: 'Sunny Scramble', levels: ['glade-4', 'glade-5', 'glade-6'], cost: 80 },
  { id: 'beyond', slot: 'east', name: 'Cheerlet Playfields', levels: ['cheerlet-1', 'cheerlet-2', 'cheerlet-3'], cost: 180 },
] as const;
export type CampaignTileId = (typeof TILE_CAMPAIGNS)[number]['id'];
export const homeCampaignComplete = (completed: readonly string[]) => TILE_CAMPAIGNS[0].levels.every(id => completed.includes(id));
