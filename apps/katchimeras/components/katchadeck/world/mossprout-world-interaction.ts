export type MossproutWorldInteractionRequest = {
  creatureId: string;
  ftueConversationDefinitionId?: string;
  journeyReturnConversationDefinitionId?: string;
  key: string;
  residentStoryResumeRequested?: boolean;
  source?: 'merge-world';
};
