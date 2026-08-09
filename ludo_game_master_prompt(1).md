# Ludo Game Development Master Prompt

## Project: Multiplayer Ludo with Power Cards

Build a production-ready, responsive multiplayer Ludo game using Next.js, TypeScript and modern web technologies.

The first version must focus on a polished core Ludo experience. Do NOT build unnecessary features before the core game is stable.

---

## 1. Product Vision

Create a modern social Ludo game for players roughly 8–25 years old.

Core experience:

1. Create or join a private room.
2. 2–4 players join the room.
3. Players see a beautiful Ludo board.
4. Players roll dice on their turn.
5. Players move their tokens according to standard Ludo rules.
6. Add a small set of optional Power Cards.
7. Show real-time game state to every player.
8. Support reconnecting if a player temporarily loses internet.
9. Add optional voice/video calling as a separate layer, but keep the game playable without it.

The game should feel casual, colorful, social and fast.

---

# 2. Recommended Technology

Frontend:
- Next.js (App Router)
- TypeScript
- React
- Tailwind CSS
- Framer Motion for animations

Game rendering:
- Start with React/CSS/SVG for the board if performance is sufficient.
- Keep the game-engine logic independent from the UI so it can later be moved to Canvas/PixiJS if needed.

Realtime:
- WebSockets / Socket.IO for live game state.
- The authoritative game state must live on the server.

Backend:
- Next.js API/server functionality for normal application operations.
- A dedicated realtime game server/service for multiplayer rooms when required.

Database:
- PostgreSQL
- Supabase can be used for PostgreSQL, authentication and storage.

Authentication:
- Supabase Auth or another secure authentication provider.

Video:
- WebRTC.
- Prefer a managed WebRTC solution such as LiveKit for production rather than implementing an entire media infrastructure from scratch.

---

# 3. Important Architecture Rule

The client must NEVER be authoritative for:

- Dice results
- Token movement legality
- Turn order
- Captures
- Winning
- Power-card effects
- Rewards
- Game completion

The server must validate every action.

Example:

Client:
"ROLL_DICE"

Server:
1. Check authenticated player.
2. Check room.
3. Check that it is player's turn.
4. Generate secure random dice result.
5. Calculate legal moves.
6. Update authoritative game state.
7. Broadcast the new state to all players.

Never accept a dice value supplied by the client.

---

# 4. MVP Screens

Create these screens:

## Landing Page
- Logo
- Play Now
- Create Room
- Join Room
- Login/Profile
- Short explanation of the game

## Login / Signup
- Simple authentication
- Username/profile creation

## Lobby
- Create private room
- Join room using room code
- Player slots
- Ready button
- Start Game button for host

## Game Room
- Ludo board
- Player information
- Dice
- Current-turn indicator
- Power cards
- Chat/reactions
- Optional voice/video controls

## Results
- Winner
- Rankings
- Match statistics
- Play Again
- Return to Lobby

## Profile
- Username
- Avatar
- Games played
- Wins
- Win rate
- Level/XP
- Cosmetics

---

# 5. Ludo Rules

Implement standard Ludo rules.

Players:
- 2–4 players.

Each player:
- 4 tokens.
- Tokens begin inside their home/base area.
- A token enters the main track after the required dice condition according to the chosen ruleset.
- Tokens travel around the board and enter their own final home path.
- The player who gets all four tokens to the final home position wins.

The rules must be configurable so variations can be enabled later.

At minimum implement:
- Dice roll
- Legal token selection
- Token movement
- Safe cells
- Capturing opponent tokens
- Home/base
- Final home path
- Winning condition
- Turn progression
- Extra turn rules
- Game over state

Do not hard-code movement logic into React components.

Create a reusable game engine.

---

# 6. Game Engine

Create a pure TypeScript game engine.

Suggested structure:

```text
src/
  game/
    engine/
      constants.ts
      types.ts
      board.ts
      dice.ts
      movement.ts
      rules.ts
      powerCards.ts
      validation.ts
      reducer.ts
      selectors.ts
```

The engine should expose functions such as:

```ts
createGame()
rollDice()
getLegalMoves()
moveToken()
canUsePowerCard()
usePowerCard()
nextTurn()
checkWinner()
```

All functions must be deterministic except secure server-side dice generation.

The UI should never directly mutate the game state.

---

# 7. Board Design

Create a visually polished Ludo board.

Requirements:
- Responsive square board.
- Works on desktop, tablet and mobile.
- Four player colors.
- Clear home areas.
- Clear safe cells.
- Clear start cells.
- Clear final paths.
- Token positions must remain unambiguous.
- Use animations for movement.

Avoid making the board look like a generic template.

Design style:
- Modern casual mobile game.
- Rounded shapes.
- Soft shadows.
- Strong but pleasant colors.
- Large readable controls.
- Fun micro-animations.

---

# 8. Dice

Create an animated dice component.

States:
- Idle
- Rolling
- Result

Requirements:
- Roll animation.
- Disable button when it is not the player's turn.
- Prevent double-clicking.
- Server decides the result.
- Display the result to every player.
- Highlight tokens that can legally move.

Optional:
- Dice skin system later.

---

# 9. Token Movement

Token movement must be animated.

Requirements:
- Move cell by cell.
- Smooth animation.
- Highlight selectable tokens.
- Show capture animation.
- Show home animation.
- Prevent illegal movement.

If a player has multiple legal tokens, clearly highlight all legal choices.

---

# 10. Power Cards

Add a small and balanced Power Card system.

Start with ONLY five cards:

### Extra Move
Allows the player to make one additional legal move according to defined rules.

### Shield
Protects one selected token from capture for a limited turn/event.

### Swap
Allows a legal token-position swap under clearly defined restrictions.

### Lucky Roll
Allows the player to select a dice result from an allowed range.

### Attack
Applies a controlled capture-related effect according to the game rules.

Important:
- Power cards must not make the game unfair.
- Define exact restrictions for every card.
- Do not allow unlimited use.
- Cards must be visible to the player.
- Other players should receive appropriate game-state updates.

For MVP, cards can be earned through gameplay rather than purchased.

---

# 11. Power Card UI

Show cards near the player's controls.

Each card should display:
- Icon
- Name
- Short description
- Availability
- Cooldown/restriction if applicable

When a card is selected:
- Show confirmation if the action is significant.
- Highlight valid targets.
- Explain why an action is invalid.

---

# 12. Multiplayer

Support:
- Private rooms
- Room codes
- 2–4 players
- Ready state
- Host
- Player disconnect
- Reconnect
- Game state synchronization

Room example:

```text
Room: ABC123

Player 1: Ready
Player 2: Ready
Player 3: Waiting
Player 4: Empty
```

Only the host can start the game once minimum players are ready.

---

# 13. Reconnection

If a player loses connection:
- Preserve the match.
- Show "Reconnecting..."
- Allow the player to reconnect to the same room.
- Restore the current game state from the server.

Do not reset the match because of a temporary network failure.

Add an inactivity timeout later.

---

# 14. Video / Voice Calling

Implement video calling as an independent module.

Do not tightly couple WebRTC state to the Ludo game engine.

Features:
- Camera on/off
- Microphone on/off
- Speaker control where supported
- Minimize video
- Expand video
- Leave call without leaving game
- Connection status

For a private room, players can optionally start a video call.

IMPORTANT SAFETY DESIGN:
- Do not expose random video matching to minors.
- Use private/approved rooms.
- Add block/report controls.
- Add parental controls and age-appropriate privacy defaults.
- Camera must be optional.
- Do not require users to reveal their real-world location.
- Do not expose precise location data.

For the first MVP, it is acceptable to implement the video UI with a provider abstraction and integrate LiveKit/WebRTC after the game core is stable.

---

# 15. Chat and Reactions

For MVP:
- Quick reactions/emotes.
- Optional short text chat.

Examples:
- 😂
- 😎
- 😭
- 🔥
- GG

Add rate limiting and moderation.

For minors, avoid unrestricted communication with unknown users.

---

# 16. Database Schema

Use PostgreSQL.

Suggested tables:

```text
users
profiles
friends
game_rooms
game_players
games
game_moves
power_card_inventory
user_inventory
cosmetics
user_cosmetics
match_results
reports
```

Do not store every UI event unnecessarily.

For game moves, store enough information for:
- Debugging
- Match history
- Anti-cheat analysis
- Replays later

---

# 17. Suggested Game Types

Create types similar to:

```ts
type PlayerColor = "red" | "green" | "yellow" | "blue";

type GameStatus =
  | "waiting"
  | "starting"
  | "playing"
  | "finished";

type TokenStatus =
  | "home"
  | "active"
  | "finished";

interface Token {
  id: string;
  playerId: string;
  index: number;
  status: TokenStatus;
  position: number;
}

interface Player {
  id: string;
  username: string;
  color: PlayerColor;
  connected: boolean;
  ready: boolean;
}

interface DiceState {
  value: number | null;
  rolling: boolean;
}

interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  players: Player[];
  currentPlayerId: string;
  dice: DiceState;
  tokens: Token[];
  powerCards: Record<string, string[]>;
  winnerId?: string;
  turnNumber: number;
}
```

Adapt the types to the actual rules implementation.

---

# 18. API / Socket Events

Define a clean event protocol.

Examples:

```text
room:create
room:join
room:leave
room:ready
game:start

game:roll
game:move
game:power-card
game:state

player:disconnect
player:reconnect

chat:message
reaction:send

call:join
call:leave
```

The server must validate every game action.

---

# 19. Anti-Cheat

Build basic anti-cheat into the architecture from day one.

Server validates:
- Turn ownership
- Dice generation
- Legal movement
- Power-card availability
- Target validity
- Game status
- Player membership
- Duplicate actions
- Impossible moves

Add:
- Action IDs
- Server timestamps
- Rate limits
- Idempotency for important actions

Never trust:
- Client score
- Client dice result
- Client winner status
- Client reward amount

---

# 20. Monetization Architecture

Do NOT add real-money betting or gambling mechanics.

Potential future monetization:
- Character skins
- Dice skins
- Board themes
- Emotes
- Avatars
- Animated effects
- Season pass
- Optional cosmetic bundles

Gameplay power should not simply be purchasable with real money.

Because the target audience includes minors, build age-appropriate purchasing and parental-control flows before introducing paid items.

---

# 21. UI Requirements

Make the interface mobile-first.

On mobile:
- Board should occupy most of the screen.
- Controls should remain reachable.
- Video windows should be small and movable.
- Power cards should not cover the board.
- Use bottom-sheet style controls if necessary.

On desktop:
- Board centered.
- Player information around the board.
- Video call panel on the side.
- Power cards in the bottom control area.

Use responsive breakpoints.

---

# 22. Animation Requirements

Use Framer Motion for:
- Dice roll
- Token movement
- Capture
- Power card activation
- Turn transition
- Winner celebration
- Buttons
- Modal transitions

Animations must be fast and not interfere with gameplay.

Provide reduced-motion support.

---

# 23. Audio

Add:
- Dice sound
- Token movement sound
- Capture sound
- Power-card sound
- Victory sound
- Button click

Add a settings screen:
- Music volume
- Sound effects volume
- Voice volume
- Mute all

Do not use copyrighted music or assets without permission.

---

# 24. Security

Implement:
- Authentication
- Authorization
- Server-side validation
- Input validation
- Rate limiting
- Secure WebSocket authentication
- Room access validation
- Database security rules
- Safe error handling

Never expose secret API keys to the client.

---

# 25. Development Phases

## Phase 1 — Offline Prototype
Build:
- Board
- Tokens
- Dice
- Movement
- Standard rules
- Power cards
- Win condition

Use fake/local players.

## Phase 2 — Online Multiplayer
Add:
- Authentication
- Rooms
- WebSockets
- 2–4 players
- Server-authoritative game engine
- Reconnection

## Phase 3 — Social
Add:
- Friends
- Profiles
- Reactions
- Chat
- Match history

## Phase 4 — Video
Add:
- WebRTC/LiveKit
- Private room video
- Camera/mic controls
- Safety/reporting features

## Phase 5 — Cosmetics
Add:
- Avatars
- Dice skins
- Board skins
- Emotes
- Inventory

## Phase 6 — Production
Add:
- Analytics
- Error monitoring
- Anti-cheat improvements
- Load testing
- Moderation
- Privacy controls
- Payment system if appropriate

---

# 26. Coding Rules

- Use TypeScript strictly.
- Avoid `any`.
- Keep game logic independent from UI.
- Use reusable components.
- Use clear naming.
- Add comments only where logic is non-obvious.
- Do not duplicate game rules.
- Do not put secrets in `.env` files that are exposed to the browser.
- Validate all server input.
- Write unit tests for the game engine.
- Write integration tests for multiplayer actions.
- Keep the project easy to extend.

---

# 27. Testing

Create tests for:

### Dice
- Valid values 1–6.
- Server-generated results.
- Correct turn validation.

### Movement
- Legal movement.
- Illegal movement.
- Home entry.
- Capture.
- Safe cells.
- Final path.
- Finish.

### Power Cards
- Valid card use.
- Invalid card use.
- Correct target.
- Card consumption.
- Restrictions.

### Multiplayer
- Two players.
- Four players.
- Duplicate actions.
- Disconnect.
- Reconnect.
- Simultaneous requests.
- Game completion.

---

# 28. Deliverables

Generate the project with:

```text
app/
components/
game/
lib/
server/
hooks/
types/
public/
tests/
```

Include:

- README.md
- `.env.example`
- Database schema/migrations
- Game engine tests
- Setup instructions
- Development commands
- Production deployment instructions
- Architecture documentation

---

# 29. Build Order

IMPORTANT:

Do not attempt to build the entire product in one step.

Build in this order:

1. Create Next.js project.
2. Create the Ludo board UI.
3. Implement local single-device game engine.
4. Test all Ludo rules.
5. Add power cards.
6. Add authentication.
7. Add private rooms.
8. Move game state to server.
9. Add WebSocket synchronization.
10. Add reconnection.
11. Add profiles/friends.
12. Add video calling.
13. Add cosmetics.
14. Add monetization.

After each phase, verify that the previous phase still works.

---

# 30. Final Product Goal

The finished product should feel like:

"An easy-to-play modern Ludo game where friends can meet in a private room, talk through optional video/voice, use fun power cards, and compete in short social matches."

The game should be:
- Simple
- Fast
- Social
- Mobile-friendly
- Secure
- Fair
- Easy to expand

Do NOT overcomplicate the first version.

The priority is:

CORE GAMEPLAY > MULTIPLAYER STABILITY > SOCIAL FEATURES > VIDEO > COSMETICS > MONETIZATION


---

# 31. Visual Design System — Color Theme

Use a premium, playful **modern board-game visual identity**. The game must look polished and original, not like a basic Ludo clone.

## Primary Color Palette

Use these as the core design tokens:

- Deep Navy: `#101828` — primary dark text/background accents
- Royal Purple: `#6C4BF4` — primary brand/action color
- Electric Blue: `#3B82F6` — information/highlight
- Coral: `#FF6B6B` — energetic accent
- Golden Yellow: `#FFC857` — rewards, coins and highlights
- Mint Green: `#38D39F` — success/positive states
- Off White: `#F8FAFC` — main background
- White: `#FFFFFF` — cards and surfaces

## Ludo Player Colors

Use four clearly distinguishable player colors:

- Red / Coral
- Blue
- Green / Mint
- Yellow / Gold

Do not use overly neon colors. Keep the colors rich, friendly and readable.

## Visual Style

The overall visual language should be:

- Premium casual gaming
- Rounded but not childish
- Clean
- Colorful
- Soft 3D/depth effect
- Subtle gradients
- Soft shadows
- Glossy game elements where appropriate
- Clear typography
- Large touch targets

Avoid:
- Excessive glassmorphism
- Excessive gradients
- Generic AI-looking UI
- Too many cards/boxes
- Heavy borders everywhere
- Cluttered screens
- Corporate dashboard styling

The game should feel like a **real mobile game**, not a website pretending to be a game.

---

# 32. Typography

Use a modern, friendly font.

Preferred:
- Inter
- Plus Jakarta Sans
- Nunito Sans

Use:
- Bold headings
- Medium labels
- Highly readable body text

Game buttons should use short labels such as:

`ROLL`
`PLAY`
`JOIN`
`READY`
`USE CARD`
`REMATCH`

---

# 33. Main Game Layout

Design the desktop game screen approximately like this:

```text
┌──────────────────────────────────────────────────────────┐
│ Logo        Room: ABC123       ⚙ Settings    👤 Profile │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Player 1 📹                              Player 2 📹    │
│  Avatar • 120 XP                          Avatar • 90 XP │
│                                                          │
│                 ┌────────────────────┐                   │
│                 │                    │                   │
│                 │                    │                   │
│                 │    LUDO BOARD      │                   │
│                 │                    │                   │
│                 │                    │                   │
│                 └────────────────────┘                   │
│                                                          │
│  Player 3 📹                              Player 4 📹    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ 🃏 Power Cards        🎲 ROLL       💬 😎 😂 🔥          │
└──────────────────────────────────────────────────────────┘
```

On mobile, reorganize responsively:

```text
┌─────────────────────┐
│ 👤      Room      ⚙ │
├─────────────────────┤
│   📹  Player 2      │
│                     │
│   ┌─────────────┐   │
│   │             │   │
│   │ LUDO BOARD  │   │
│   │             │   │
│   └─────────────┘   │
│                     │
│ Player 1    Player 3│
│                     │
├─────────────────────┤
│ 🃏 Cards            │
│                     │
│       🎲 ROLL       │
│                     │
│       😎 😂 🔥      │
└─────────────────────┘
```

The board must always remain the visual focus.

---

# 34. Lobby Layout

The lobby should feel like a gaming room rather than a form.

```text
┌─────────────────────────────────────────┐
│              🎲 LUDO                     │
│                                         │
│          ROOM: ABC123                   │
│                                         │
│   👤 Player 1       🟢 READY             │
│   👤 Player 2       🟢 READY             │
│   👤 Player 3       ⚪ WAITING            │
│   👤 Empty          ➕ INVITE             │
│                                         │
│          [ START GAME ]                 │
│                                         │
│        📋 Copy Room Code                │
└─────────────────────────────────────────┘
```

Use a strong primary CTA and minimal secondary controls.

---

# 35. Video Call Layout

Video should never cover important gameplay.

Desktop:
- Small floating video tiles around the board.
- Active speaker can be slightly larger.
- User can minimize the entire call.

Mobile:
- Small draggable video bubbles.
- Tap to expand.
- Collapse button.
- Video must never block the dice or legal token selection.

Example:

```text
       ┌───────┐
       │ 📹 A  │
       └───────┘

          LUDO
        BOARD

       ┌───────┐
       │ 📹 B  │
       └───────┘
```

---

# 36. Power Card Visual Design

Power cards should look collectible.

Example:

```text
┌──────────────┐
│      ⚡      │
│   EXTRA MOVE │
│              │
│   AVAILABLE  │
└──────────────┘
```

Each card should have:
- Unique icon
- Player-color accent
- Short name
- Short description
- Available/used state
- Subtle hover animation
- Selection animation

Do not use excessive text.

---

# 37. Image / Asset Generation

Use generated artwork for the game's visual assets when appropriate.

IMPORTANT:
- Generate original assets.
- Do not copy copyrighted game characters, boards, logos or artwork from Ludo King, Roblox, Fortnite or other games.
- Do not imitate another company's exact visual identity.
- Keep the art consistent across the entire product.

## Asset Categories

Generate:

1. Game logo
2. Four player avatars
3. Four token styles
4. Dice
5. Power-card icons
6. Coins
7. Reward chest
8. Victory trophy
9. Background illustrations
10. Board decorative elements
11. Emote icons
12. Profile frames
13. Dice skins
14. Board theme artwork

## Image Generation Style Prompt

Use the following base prompt when generating visual assets:

"Create original premium casual mobile board-game artwork for a modern multiplayer Ludo-inspired game. Friendly, colorful, polished, slightly playful but not childish, clean shapes, subtle 3D depth, soft studio lighting, rich saturated colors, smooth rounded forms, high-quality mobile game art, consistent visual language, no text, no logos, no copyrighted characters, transparent or clean background where appropriate."

For individual assets, append the specific object.

Example:

"Create a cute original fantasy fox game avatar, premium casual mobile board-game art, rounded 3D character, expressive face, colorful clothing, subtle 3D depth, clean silhouette, transparent background, no text, no logo."

## Logo Prompt

"Design an original premium logo for a modern multiplayer casual board game called [GAME NAME]. The logo should communicate dice, competition, friendship and fun. Minimal but memorable symbol, rounded geometry, subtle depth, purple/blue/coral/gold palette, clean typography, professional mobile gaming brand, scalable at small sizes, no resemblance to existing gaming brands."

## Board Background Prompt

"Create an original premium top-down board-game background for a modern multiplayer Ludo-style game. Four colorful player zones, clean paths, subtle decorative elements, soft 3D depth, polished mobile game aesthetic, rich but controlled colors, highly readable gameplay areas, no text, no logos, no copyrighted artwork."

---

# 38. Asset Generation Rules

Before generating an asset:
1. Define its purpose.
2. Define its dimensions/aspect ratio.
3. Keep the style consistent.
4. Generate multiple variations when useful.
5. Prefer transparent backgrounds for characters, icons and tokens.
6. Compress assets for web/mobile performance.
7. Use SVG for simple icons when possible.
8. Do not use large raster images where CSS/SVG is sufficient.

Do not generate an image for something that can be cleanly implemented using CSS, SVG or HTML.

---

# 39. Game Board Visual Direction

The board should be custom-designed rather than a plain four-color Ludo grid.

Use:
- Slightly rounded board corners
- Subtle elevation
- Decorative but unobtrusive background
- Clearly separated player zones
- Glowing/highlighted legal moves
- Animated token shadows
- Animated safe cells
- Clear finish/home area

The board should remain instantly understandable even with all animations disabled.

---

# 40. Design Tokens

Create centralized design tokens.

Example:

```ts
export const gameTheme = {
  colors: {
    brand: "#6C4BF4",
    navy: "#101828",
    blue: "#3B82F6",
    coral: "#FF6B6B",
    gold: "#FFC857",
    mint: "#38D39F",
    background: "#F8FAFC",
    white: "#FFFFFF",
  },

  players: {
    red: "#FF6B6B",
    blue: "#3B82F6",
    green: "#38D39F",
    yellow: "#FFC857",
  },

  radius: {
    sm: "10px",
    md: "16px",
    lg: "24px",
    xl: "32px",
  },
};
```

Keep all theme values centralized so the entire game can later support alternate themes.

---

# 41. UX Principle

The player should understand the screen within seconds.

When it is the player's turn:

1. Show a clear turn indicator.
2. Highlight the ROLL button.
3. Animate the dice.
4. Highlight legal tokens.
5. Let the player select a token.
6. Animate the move.
7. Show the result.
8. Transition clearly to the next player.

Never make the player guess what they need to do next.

---

# 42. Empty / Loading / Error States

Create polished states for:
- Connecting to room
- Waiting for players
- Reconnecting
- Player disconnected
- Game loading
- Server error
- Invalid room code
- Game ended
- No legal move

Use short friendly messages.

Examples:

"Waiting for your friends..."
"Reconnecting to the game..."
"Your turn!"
"No move available — passing the turn."

---

# 43. Responsive Design

The game must be designed mobile-first but work on:
- 360px mobile
- 390px mobile
- 430px mobile
- Tablet
- Laptop
- Desktop

Do not simply shrink the desktop UI.

Create separate responsive layouts where necessary.

---

# 44. Final Visual Quality Requirement

Before considering the UI complete, check:

- Does it look like a real game?
- Is the board immediately understandable?
- Is the ROLL action obvious?
- Are player colors distinguishable?
- Are tokens easy to see?
- Do power cards look exciting?
- Does video stay out of the way?
- Does the UI work on a small phone?
- Does it avoid looking like an AI-generated template?
- Does it have a consistent visual identity?

The final result should look like a professionally designed casual multiplayer game, not a generic Tailwind dashboard.
