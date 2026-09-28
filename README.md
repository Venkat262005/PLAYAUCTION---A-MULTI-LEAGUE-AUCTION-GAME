
Presentation-Link: https://drive.google.com/file/d/1DN6u87A_lVMD01ypPb8E3JY_jxVa2wPT/view?usp=sharing

# PLayAuction — Multi-League Cricket Auction Platform

A full-stack, real-time cricket auction platform supporting **IPL**, **WPL**, and **SA20** leagues. Built with React 19, Node.js, Express, Socket.io, and MongoDB. Features live bidding, AI-powered squad evaluation, a post-auction quiz phase, voice controls, an admin panel, and an immersive animated UI.

---

## 🚀 Features

- **Multi-League Support** — Run auctions for IPL (15 franchises), WPL (5 franchises), or SA20 (6 franchises) with league-specific rules, budgets, logos, and player pools.
- **Real-Time Bidding** — Synchronized bidding via Socket.io with live timer, RTM (Right to Match) cards, and bid increment rules per league.
- **Retention & RTM System** — Pre-auction player retentions and RTM card logic for WPL and SA20 leagues with validation against previous-season squads.
- **AI-Powered Squad Evaluation** — Google Gemini + Groq/LangChain integration evaluates team squads at auction end and generates ratings, insights, and recommendations.
- **Post-Auction Quiz Phase** — Built-in cricket quiz arena with leaderboard to extend the game experience after the auction.
- **Admin Panel** — Secure JWT-authenticated admin dashboard to manage rooms, players, and auction data.
- **AI Bot Players** — Configurable AI bots that participate in bidding when human teams are unavailable.
- **Immersive UI** — Animated splash screen, fullscreen toggle, credits modal, background video/audio, and voice controls.
- **Voice Controls** — Text-to-speech auction announcements via a dedicated `VoiceContext`.
- **Feedback System** — In-app feedback widget with a persistent `Feedback` model.
- **Public & Private Rooms** — Create private rooms or join browsable public rooms filtered by league.
- **Session Recovery** — Ongoing auction rooms auto-resume after server restarts by rehydrating state from MongoDB.
- **Live Leaderboard** — Real-time team rankings with AI-driven scores during and after the auction.
- **Squad Share Cards** — Generate and share team result cards using `html-to-image` and canvas confetti effects.

---

## 🛠️ Tech Stack

### Frontend (`client/`)
| Technology | Purpose |
|---|---|
| React 19 + Vite 7 | Core UI framework and build tool |
| React Router v7 | Client-side routing |
| Tailwind CSS 3 | Utility-first styling |
| Framer Motion | Page and component animations |
| Socket.io-client | Real-time bidding and state sync |
| Lucide React + React Icons | Icon library |
| html-to-image | Squad share card generation |
| canvas-confetti | Celebration effects |
| Inter & Outfit (Fontsource) | Premium typography |

### Backend (`server/`)
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | HTTP server and REST API |
| Socket.io 4 | Real-time WebSocket engine |
| MongoDB + Mongoose 9 | Primary database (multi-database: `ipl`, `SA20`, `wpl`) |
| Google Generative AI (Gemini) | AI squad evaluation and quiz generation |
| Groq SDK + LangChain | Secondary AI inference pipeline |
| JWT + bcryptjs | Admin authentication |
| UUID | Room code and session ID generation |
| Nodemon | Development hot-reload |

---

## ⚙️ Prerequisites

- **Node.js** — Latest LTS version (v20+)
- **MongoDB** — Running locally or a cloud instance (MongoDB Atlas recommended)
  - Requires separate databases: `ipl`, `SA20`, `wpl`
- **Gemini API Key** — For AI squad evaluation (`GOOGLE_API_KEY` / `GEMINI_API_KEY`)
- **Groq API Key** — For secondary AI inference (`GROQ_API_KEY`)

---

## 📂 Project Structure

```text
auctiononline/
├── client/                        # Frontend React application
│   ├── public/
│   │   ├── ipl_logos/             # IPL franchise logos (15 teams)
│   │   ├── sa20_logos/            # SA20 franchise logos (6 teams)
│   │   ├── wpl_logos/             # WPL franchise logos (5 teams)
│   │   ├── game_logos/            # Role and status icons
│   │   ├── flags/                 # National & league flags
│   │   ├── sounds/                # Auction sound effects
│   │   ├── Auction-bg.mp4         # Splash screen background video
│   │   └── Ascension_of_the_Dawn.mp4  # Ambient background music
│   ├── quiz/                      # Quiz question sets (IPL, WPL, SA20 .txt files)
│   └── src/
│       ├── components/
│       │   ├── Admin/             # Admin-specific UI components
│       │   ├── immersive/         # SplashScreen, ImmersiveWrapper, AnimatedBackground, etc.
│       │   ├── AuctionSubComponents.jsx  # Bid panel, player card, team panel
│       │   ├── CustomLineupModal.jsx     # Playing 11 customization modal
│       │   ├── FeedbackWidget.jsx
│       │   ├── GavelSlam.jsx
│       │   ├── GlobalResultCard.jsx
│       │   ├── LeagueNewsMarquee.jsx
│       │   ├── TeamShareCard.jsx
│       │   ├── Toast.jsx
│       │   ├── VoiceControls.jsx
│       │   └── WildcardDraftCenter.jsx
│       ├── context/
│       │   ├── SessionContext.jsx  # User session & room state
│       │   ├── SocketContext.jsx   # Socket.io connection
│       │   └── VoiceContext.jsx    # Text-to-speech voice announcements
│       ├── pages/
│       │   ├── Admin/
│       │   │   ├── AdminLogin.jsx
│       │   │   └── AdminDashboard.jsx
│       │   ├── AuctionPodium.jsx   # Main auction room page
│       │   ├── EvaluationLobby.jsx # Post-auction AI evaluation waiting screen
│       │   ├── Lobby.jsx           # Room creation / joining page
│       │   ├── PublicRooms.jsx     # Browse public auction rooms
│       │   ├── QuizArena.jsx       # Post-auction cricket quiz
│       │   └── ResultsReveal.jsx   # Final results & leaderboard
│       └── utils/
│           ├── bidRules.js         # Bid increment logic
│           ├── legendConfig.js     # Legend player configuration
│           ├── playerUtils.js      # Currency conversion, player helpers
│           ├── soundEngine.js      # Audio playback engine
│           ├── teamLogos.js        # Franchise logo resolution helper
│           └── teamSlogans.js      # Team slogans for UI
│
└── server/                        # Backend Express + Socket.io server
    ├── config/
    │   └── db.js                  # MongoDB connection (multi-DB support)
    ├── models/
    │   ├── ActiveRoom.js          # In-progress auction room state
    │   ├── Admin.js               # Admin user model
    │   ├── AuctionRoom.js         # Auction room persistence model
    │   ├── AuctionTransaction.js  # Bid transaction records
    │   ├── ChangeRequest.js       # Admin change request tracking
    │   ├── CompletedRoom.js       # Archived finished rooms
    │   ├── Feedback.js            # User feedback submissions
    │   ├── Franchise.js           # Franchise/team data
    │   └── Player.js              # Player document model
    ├── routes/
    │   ├── api.js                 # Public API endpoints (players, rooms)
    │   ├── admin.js               # Admin-only protected endpoints
    │   ├── changeRequests.js      # Change proposal workflow endpoints
    │   └── session.js             # Session management endpoints
    ├── scripts/
    │   ├── check_ai_status.js     # Verify Gemini/Groq AI connectivity
    │   ├── createAdmin.js         # Create an admin user
    │   └── seedAdmin.js           # Seed default admin credentials
    ├── seed/                      # Database seed scripts
    ├── services/
    │   ├── aiRating.js            # AI squad rating & Playing 11 selection
    │   ├── auctionCleanup.js      # Stagnant room cleanup service
    │   ├── dbWriter.js            # Periodic dirty-room flusher
    │   ├── geminiTeamEvaluation.js  # Gemini-based team evaluation
    │   ├── playerService.js       # Player fetch and search service
    │   ├── quizEngine.js          # Quiz question generation & management
    │   ├── sa20History.js         # SA20 previous-season squad data & retention logic
    │   └── wplHistory.js          # WPL previous-season squad data & retention logic
    ├── socket/
    │   └── auctionEngine.js       # Core Socket.io event handlers & auction state machine
    └── utils/
        ├── PlayerCache.js         # In-memory player lookup cache
        ├── Validation.js          # Input validation helpers
        ├── adminHelpers.js        # Admin utility functions
        ├── bidRules.js            # Server-side bid increment & snap logic
        ├── diffHelper.js          # Object diffing utility for change requests
        ├── legendRules.js         # Legend player detection rules
        ├── playerNormalizer.js    # Normalize player data across leagues
        ├── quizHelpers.js         # Quiz question formatting helpers
        ├── sa20PlayerRules.js     # SA20-specific player eligibility rules
        └── teamLogos.js           # Server-side team logo mapping
```

---

## 🛠️ Setup Instructions

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd auctiononline
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:

```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
# Only required for production keep-alive (Render.com free tier):
# SERVER_URL=https://your-server-url.onrender.com
```

Start the backend server:
```bash
npm run dev        # Development (nodemon hot-reload)
npm start          # Production
npm run check-ai   # Verify AI API connectivity
```

### 3. Frontend Setup

```bash
cd client
npm install
```

Create a `.env` file in the `client/` directory:

```env
VITE_API_URL=http://localhost:5001
```

> **Note:** The Vite dev server proxies `/api` and `/socket.io` to `http://127.0.0.1:5001` automatically via `vite.config.js`. The `.env` variable is used for production builds.

Start the frontend:
```bash
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

### 4. Admin Setup

After the server is running, create an admin user:

```bash
cd server
node scripts/createAdmin.js
# or
node scripts/seedAdmin.js
```

Access the admin dashboard at `/admin/login`.

---

## 🗄️ Database Setup

This project uses **three separate MongoDB databases**:

| Database | Contents |
|---|---|
| `ipl` | IPL player pools, franchises |
| `SA20` | SA20 player pools, franchises |
| `wpl` | WPL player pools, franchises |

All three are accessed from the same MongoDB connection string via Mongoose's `useDb()`. Player pool collections (e.g. `capped_players`, `uncapped_players`, `presigned_players`) must be populated in each database before running an auction.

Seed scripts in `server/seed/` can be used to import initial data.

---

## 🌐 Deployment

The application is configured for deployment on **Render.com** (backend) and **Vercel** (frontend).

- **Backend**: Set `NODE_ENV=production` and `SERVER_URL` in Render environment variables. The server includes a self-ping every 14 minutes to prevent Render free-tier spin-down.
- **Frontend**: `client/vercel.json` handles SPA routing rewrites for Vercel deployment.

---

## 📄 License

This project is licensed under the ISC License.
