export type AiUsageLatest = {
  models: string[];
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  tokenUsageComplete: boolean;
  costMicros: number | null;
  createdAt: string;
};

export type AiUsageSummary = {
  period: string;
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
  latest: AiUsageLatest | null;
};
