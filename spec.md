# Luxia Crypto Trade

## Current State
- Full crypto trading signal platform with Premium Signals (6 sub-tabs), Elite Signals, Tracking, AI Dashboard, etc.
- Signal engine generates signals from CoinGecko data with RSI/MACD/EMA/ATR/volume indicators
- Sort options: Highest Profit, Surety, TP Hitting
- Signals often not hitting TP — filters may be too loose, or TP targets are set too aggressively
- No AI Chat section in the sidebar
- Sidebar has: Profile, Home, Post, News, Tracking, AI Dashboard, Founder, AI Skills, Instructions

## Requested Changes (Diff)

### Add
1. **AI Bots Chat Page** — New sidebar tab "AI Chat" with two AI bots (Alpha Bot and Beta Bot) that:
   - Continuously chat with each other researching how to improve signal accuracy and profitability
   - Analyze current market conditions, signal patterns, and TP hit rates
   - Suggest improvements to the signal engine in real-time
   - Use Groq API (Llama 3.3-70b) for both bots with distinct personalities
   - Chat updates every 30 seconds without user intervention — bots never stop
   - User can join the conversation and ask questions to either bot
   - User can add a third "Researcher Bot" to the conversation for deeper analysis
   - Messages displayed as a live chat feed with bot avatars and distinct colors
   - Each bot message shows insights about signal quality and TP hitting improvements
   - Bots provide actionable upgrades and self-improve each other's knowledge

2. **"AI Chat" sidebar tab** — Added to SIDEBAR_TABS in App.tsx with a Bot/MessageSquare icon, routes to new AIChatPage

3. **Signal engine tighter TP targeting** — Only show signals that are highly likely to hit TP:
   - Require momentum 1%–10% (was 0.3–12%) — stronger signals only
   - Require distToHigh24h >= 3% (was 2%) — more room to run
   - Require indicatorsAligned >= 5 (was 4) — only 5-6 aligned signals
   - Increase tpConfidence gate to 55 (was 45)
   - Tighter TP: use 0.85x multiplier on calculated TP so target is more achievable
   - Only show if coin is actively rising (momentum positive and recent)

### Modify
- App.tsx: Add "aiChat" to Page type, add SIDEBAR_TABS entry for AI Chat, add case in renderPage()
- signalEngine.ts: Tighten filters for higher TP accuracy (momentum gate, indicator requirements)

### Remove
- Nothing removed

## Implementation Plan
1. Create `src/frontend/src/pages/AIChatPage.tsx` — full AI bots chat interface
2. Create `src/frontend/src/services/aiBotChat.ts` — Groq API calls for bot conversations
3. Update `src/frontend/src/App.tsx` — add Page type, sidebar tab, route
4. Update `src/frontend/src/services/signalEngine.ts` — tighter signal filters for TP accuracy
