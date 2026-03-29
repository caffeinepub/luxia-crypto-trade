import Outcall "http-outcalls/outcall";
import Array "mo:base/Array";
import Nat "mo:base/Nat";
import Text "mo:base/Text";

actor {

  // All registered users serialised as JSON
  stable var usersData : Text = "";

  // Per-user tracked trades: association list of (uid, json) tuples
  stable var trackedTradesEntries : [(Text, Text)] = [];

  // Shared AI learning data (one store for all users)
  stable var aiLearningData : Text = "";

  // Global trade outcome counters
  stable var globalHits   : Nat = 0;
  stable var globalMisses : Nat = 0;

  // Coin profiles (per-coin AI signal parameters) — shared across all users
  stable var coinProfilesData : Text = "";

  // AI Skill Engine logs — shared
  stable var aiSkillLogData : Text = "";
  stable var aiParamHistoryData : Text = "";
  stable var aiRewriteLogData : Text = "";

  // Helper: find value in assoc list
  func assocGet(entries : [(Text, Text)], key : Text) : Text {
    for ((k, v) in entries.vals()) {
      if (k == key) return v;
    };
    return "";
  };

  // Helper: upsert into assoc list
  func assocPut(entries : [(Text, Text)], key : Text, value : Text) : [(Text, Text)] {
    let filtered = Array.filter(entries, func((k, _) : (Text, Text)) : Bool { k != key });
    Array.append(filtered, [(key, value)])
  };

  // ── Users ──────────────────────────────────────────────────

  public func saveUsers(data : Text) : async () {
    usersData := data;
  };

  public query func getUsers() : async Text {
    usersData
  };

  // ── Per-user tracked trades ──────────────────────────────────────

  public func saveTrackedTrades(uid : Text, data : Text) : async () {
    trackedTradesEntries := assocPut(trackedTradesEntries, uid, data);
  };

  public query func getTrackedTrades(uid : Text) : async Text {
    assocGet(trackedTradesEntries, uid)
  };

  // ── Shared AI learning ───────────────────────────────────────

  public func saveAILearning(data : Text) : async () {
    aiLearningData := data;
  };

  public query func getAILearning() : async Text {
    aiLearningData
  };

  // ── Coin profiles ─────────────────────────────────────────────

  public func saveCoinProfiles(data : Text) : async () {
    coinProfilesData := data;
  };

  public query func getCoinProfiles() : async Text {
    coinProfilesData
  };

  // ── AI Skill logs ─────────────────────────────────────────────

  public func saveAISkillLog(data : Text) : async () {
    aiSkillLogData := data;
  };

  public query func getAISkillLog() : async Text {
    aiSkillLogData
  };

  public func saveAIParamHistory(data : Text) : async () {
    aiParamHistoryData := data;
  };

  public query func getAIParamHistory() : async Text {
    aiParamHistoryData
  };

  public func saveAIRewriteLog(data : Text) : async () {
    aiRewriteLogData := data;
  };

  public query func getAIRewriteLog() : async Text {
    aiRewriteLogData
  };

  // ── Global trade stats ────────────────────────────────────────

  public func recordGlobalOutcome(outcome : Text) : async () {
    if (outcome == "hit") {
      globalHits += 1;
    } else {
      globalMisses += 1;
    };
  };

  public query func getGlobalStats() : async Text {
    "{\"hits\":" # Nat.toText(globalHits) # ",\"misses\":" # Nat.toText(globalMisses) # "}"
  };

  // ── HTTP outcalls ─────────────────────────────────────────────

  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input)
  };

  public func getBingXSymbols() : async Text {
    try {
      await Outcall.httpGetRequest(
        "https://open-api.bingx.com/openApi/spot/v1/common/symbols",
        [],
        transform
      )
    } catch (_e) {
      "{\"error\":\"fetch failed\"}"
    }
  };

  public func getCoinGeckoPage(page : Nat) : async Text {
    let pageStr = switch (page) {
      case 1 { "1" }; case 2 { "2" }; case 3 { "3" }; case 4 { "4" };
      case 5 { "5" }; case 6 { "6" }; case 7 { "7" }; case 8 { "8" };
      case 9 { "9" }; case 10 { "10" }; case 11 { "11" }; case 12 { "12" };
      case 13 { "13" }; case 14 { "14" }; case 15 { "15" }; case 16 { "16" };
      case 17 { "17" }; case 18 { "18" }; case 19 { "19" }; case _ { "20" };
    };
    try {
      await Outcall.httpGetRequest(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=100&page=" # pageStr # "&sparkline=false",
        [],
        transform
      )
    } catch (_e) {
      "[]"
    }
  };

}
