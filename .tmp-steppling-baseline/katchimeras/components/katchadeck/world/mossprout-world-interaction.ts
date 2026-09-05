export type MossproutWorldInteractionRequest = {
  creatureId: 'companion:mossprout';
  ftueConversationDefinitionId?: string;
  journeyReturnConversationDefinitionId?: string;
  key: string;
  residentStoryResumeRequested?: boolean;
  source?: 'merge-world';
};
