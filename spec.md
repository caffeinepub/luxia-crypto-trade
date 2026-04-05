# Luxia Crypto Trade

## Current State
- AIChatPage.tsx: Two AI bots (Alpha, Beta) + optional Researcher bot chat together in a sidebar tab. Has "Session Insights" sidebar panel and "Quick Questions" shortcuts. Bots discuss signal improvements every 35 seconds.
- aiBotChat.ts: Service handles Groq AI calls. Bots only discuss signal quality, RSI/MACD/TP improvements — no internet research.
- PostPage.tsx: Admin can create posts manually. Static posts only.

## Requested Changes (Diff)

### Add
- **3 new specialized research bots** alongside Alpha and Beta:
  - **Omega Bot** (100x/1000x Hunter): Scans CoinGecko for gems, low-cap breakouts, early altcoin momentum. Posts discoveries as user-facing coin suggestions.
  - **Delta Bot** (Boom Detector): Monitors coins going to boom — volume surges, RSI resets from oversold, breakout from consolidation. Posts live alerts.
  - **Sigma Bot** (Deep Crypto Researcher): Researches trending crypto topics, sector rotations, macro trends via Groq knowledge. Shares insights continuously.
- **Auto-post system**: Bots automatically publish coin suggestions to the Posts feed. Posts tagged as "AI RESEARCH", "100X CANDIDATE", or "GOING TO BOOM" so users see them as public announcements.
- **Coins Going to Boom feed**: Live feed panel in AI Chat showing coins detected by Delta Bot as pre-boom — with ticker, % momentum, volume surge, and a reason.
- **Live CoinGecko research integration**: Bots fetch top gainers, trending coins, and volume anomalies from CoinGecko API to ground their research in real data.
- **Never-repeat-topic engine**: Track discussed topics; each bot round picks a new crypto research topic (DeFi, Layer2, memecoins, NFTs, BTC dominance, etc.) cycling through 20+ topics.
- **Bot research log**: Panel showing the last N research topics covered, so user can see breadth of coverage.

### Modify
- **Remove** "Session Insights" sidebar panel from AIChatPage.
- **Remove** "Quick Questions" shortcuts from AIChatPage.
- **Replace sidebar** with "Coins Going to Boom" live feed panel and "Bot Research Log".
- **Upgrade bot system prompts** to act as professional crypto researchers doing internet-level deep research, finding 100x coins, and suggesting them to users.
- **Upgrade conversation starters and fallbacks** to cover all crypto topics: DeFi, NFTs, layer 2, memecoins, macro, altseason, whale activity, sector rotation.
- **Interval reduced to 20s** (was 35s) for faster continuous research.
- **PostPage.tsx**: AI-generated posts now appear in the posts feed automatically with a special "AI" badge.

### Remove
- Session Insights panel
- Quick Questions section

## Implementation Plan
1. Upgrade `aiBotChat.ts`:
   - Add Omega, Delta, Sigma bot configs and system prompts
   - Add topic rotation engine (20+ topics, never repeats until full cycle)
   - Add CoinGecko integration: fetch top gainers, trending, volume anomalies
   - Add `generateBoomPost()` function that creates auto-posts with coin suggestions
   - Add `getResearchTopic()` that cycles unique topics
   - Export boom coin list and research log state
2. Upgrade `AIChatPage.tsx`:
   - Remove Session Insights sidebar, remove Quick Questions
   - Add 5 bot status cards (Alpha, Beta, Omega, Delta, Sigma) — all active by default
   - Replace sidebar with Coins Going to Boom live feed + Research Log
   - Reduce auto-run interval to 20s
   - Show auto-published post notifications when bots post coin suggestions
3. Upgrade `PostPage.tsx`:
   - Auto-load AI-generated posts from localStorage key `luxia_ai_posts`
   - Show with purple "AI RESEARCH" / gold "100X" / green "BOOM" badges
   - Merge with admin posts, AI posts appear at top
