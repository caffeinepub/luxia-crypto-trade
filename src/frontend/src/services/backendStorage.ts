import { createActorWithConfig } from "../config";

let actorInstance: any = null;
let actorPromise: Promise<any> | null = null;

async function getActor(): Promise<any> {
  try {
    if (actorInstance) return actorInstance;
    if (actorPromise) return await actorPromise;
    actorPromise = createActorWithConfig().then((a) => {
      actorInstance = a;
      return a;
    });
    return await actorPromise;
  } catch {
    actorPromise = null;
    return null;
  }
}

// Users (all registered accounts)
export async function loadUsersFromBackend(): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getUsers();
    return result || "";
  } catch {
    return "";
  }
}

export async function saveUsersToBackend(data: string): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveUsers(data);
  } catch {}
}

// Per-user tracked trades
export async function loadTrackedTradesFromBackend(
  uid: string,
): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getTrackedTrades(uid);
    return result || "";
  } catch {
    return "";
  }
}

export async function saveTrackedTradesToBackend(
  uid: string,
  data: string,
): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveTrackedTrades(uid, data);
  } catch {}
}

// Shared AI learning
export async function loadAILearningFromBackend(): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getAILearning();
    return result || "";
  } catch {
    return "";
  }
}

export async function saveAILearningToBackend(data: string): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveAILearning(data);
  } catch {}
}

// Coin profiles
export async function loadCoinProfilesFromBackend(): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getCoinProfiles();
    return result || "";
  } catch {
    return "";
  }
}

export async function saveCoinProfilesToBackend(data: string): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveCoinProfiles(data);
  } catch {}
}

// AI Skill logs
export async function loadAISkillLogFromBackend(): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getAISkillLog();
    return result || "";
  } catch {
    return "";
  }
}

export async function saveAISkillLogToBackend(data: string): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveAISkillLog(data);
  } catch {}
}

export async function loadAIParamHistoryFromBackend(): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getAIParamHistory();
    return result || "";
  } catch {
    return "";
  }
}

export async function saveAIParamHistoryToBackend(data: string): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveAIParamHistory(data);
  } catch {}
}

export async function loadAIRewriteLogFromBackend(): Promise<string> {
  try {
    const actor = await getActor();
    if (!actor) return "";
    const result = await actor.getAIRewriteLog();
    return result || "";
  } catch {
    return "";
  }
}

export async function saveAIRewriteLogToBackend(data: string): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.saveAIRewriteLog(data);
  } catch {}
}

// Global stats
export async function recordGlobalOutcome(
  outcome: "hit" | "miss",
): Promise<void> {
  try {
    const actor = await getActor();
    if (!actor) return;
    await actor.recordGlobalOutcome(outcome);
  } catch {}
}

export async function loadGlobalStats(): Promise<{
  hits: number;
  misses: number;
}> {
  try {
    const actor = await getActor();
    if (!actor) return { hits: 0, misses: 0 };
    const raw = await actor.getGlobalStats();
    return JSON.parse(raw) as { hits: number; misses: number };
  } catch {
    return { hits: 0, misses: 0 };
  }
}

// CoinGecko via backend (avoids browser CORS/rate limits)
export async function fetchCoinGeckoPageViaBackend(
  page: number,
): Promise<any[]> {
  try {
    const actor = await getActor();
    if (!actor) return [];
    const raw = await actor.getCoinGeckoPage(BigInt(page));
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
