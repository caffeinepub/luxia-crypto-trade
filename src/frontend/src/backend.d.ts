import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface backendInterface {
  // Users permanent storage
  saveUsers(data: string): Promise<void>;
  getUsers(): Promise<string>;
  // Per-user tracked trades
  saveTrackedTrades(uid: string, data: string): Promise<void>;
  getTrackedTrades(uid: string): Promise<string>;
  // Shared AI learning
  saveAILearning(data: string): Promise<void>;
  getAILearning(): Promise<string>;
  // Global trade stats
  recordGlobalOutcome(outcome: string): Promise<void>;
  getGlobalStats(): Promise<string>;
  // HTTP outcalls
  getBingXSymbols(): Promise<string>;
  getCoinGeckoPage(page: bigint): Promise<string>;
}
