import {
  ON_DEVICE_FIRST_POLICY,
  type IntelligencePolicy,
  type IntelligenceProvider,
  type IntelligenceProviderId,
  type IntelligenceResult,
  type IntelligenceTaskName,
} from './types';

type RunOptions<TInput, TOutput> = {
  task: IntelligenceTaskName;
  input: TInput;
  providers: IntelligenceProvider<TInput, TOutput>[];
  sourceIds?: string[];
  policy?: IntelligencePolicy;
  now?: Date;
};

export async function runIntelligenceTask<TInput, TOutput>({
  task,
  input,
  providers,
  sourceIds = [],
  policy = ON_DEVICE_FIRST_POLICY,
  now = new Date(),
}: RunOptions<TInput, TOutput>): Promise<IntelligenceResult<TOutput> | null> {
  const errors: string[] = [];
  const orderedProviders = orderProviders(providers, policy.providerOrder).filter(
    (provider) => policy.allowRemote || provider.id !== 'remoteLlm'
  );

  for (const provider of orderedProviders) {
    try {
      const canRun = await provider.canRun(input);
      if (!canRun) {
        continue;
      }
      const value = await withTimeout(provider.run(input), policy.timeoutMs ?? 3000);
      if (value == null) {
        continue;
      }
      const deterministicIndex = policy.providerOrder.indexOf('deterministic');
      const providerIndex = policy.providerOrder.indexOf(provider.id);
      return {
        task,
        value,
        provider: provider.id,
        confidence: clamp01(provider.confidence ? provider.confidence(value, input) : 0.75),
        sourceIds,
        createdAt: now.toISOString(),
        fallbackUsed: deterministicIndex >= 0 && providerIndex >= deterministicIndex,
        errors,
      };
    } catch (error) {
      errors.push(`${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
}

function orderProviders<TInput, TOutput>(
  providers: IntelligenceProvider<TInput, TOutput>[],
  order: IntelligenceProviderId[]
): IntelligenceProvider<TInput, TOutput>[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...providers].sort((left, right) => (rank.get(left.id) ?? 999) - (rank.get(right.id) ?? 999));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

