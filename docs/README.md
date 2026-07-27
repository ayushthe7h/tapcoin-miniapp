# TapCoin — Telegram Mini App (Tap-to-Earn)

A production-oriented tap-to-earn Telegram Mini App: React frontend, FastAPI backend,
**SQLite** database, and an aiogram bot — with mining, daily rewards, tasks, a real
referral system, leaderboards, a wallet placeholder (withdrawals intentionally disabled),
and a full admin panel.

Runs entirely without Docker, Postgres, or Redis. The only dependency is Python +
Node — SQLite is a single file (`tapcoin.db`) created automatically the first time
the backend starts.

## Folder structure

```
backend/    FastAPI app (auth, mining, tasks, referral, leaderboard, admin, ...)
bot/        aiogram Telegram bot (/start opens the Mini App, forwards referral codes)
frontend/   React + Vite + Tailwind + Framer Motion Mini App + Admin UI
nginx/      Optional reverse proxy config for a bare VPS deployment
docs/       This file
```

## 1. Prerequisites

- Python 3.10+ and Node 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather) (also set the Mini App
  URL via `/newapp` or `/setmenubutton` once deployed)

No database server, no Docker, no Redis — SQLite and in-process rate limiting handle
everything.

## 2. Configure environment variables

Copy each `.env.example` to `.env` and fill in real values:

```
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
cp frontend/.env.example frontend/.env
```

Key values:
- `BOT_TOKEN` — must match in both `backend/.env` and `bot/.env`
- `DATABASE_URL` — defaults to `sqlite+aiosqlite:///./tapcoin.db`; leave it alone unless
  you want the file somewhere else. No other database engine is supported.
- `JWT_SECRET` / `ADMIN_JWT_SECRET` — long random strings, **must differ from each other**
- `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` — created automatically on first
  backend startup if no admin exists yet. **Change the password immediately after first login.**
- `CORS_ORIGINS` — your frontend's real domain(s), comma-separated
- `VITE_API_URL` (frontend) — your backend's public URL, e.g. `https://api.yourdomain.com`

## 3. Run it

Three processes, three terminals, no Docker:

```bash
# Backend — creates tapcoin.db and all tables automatically on first run
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Bot
cd bot
pip install -r requirements.txt
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

That's it — `backend/tapcoin.db` is created the moment `uvicorn` starts for the first
time, with every table already in place. For a production build of the frontend, use
`npm run build` and serve `frontend/dist` with any static file server or the example
`nginx/vps.conf`.

## 4. Connecting the bot to the Mini App

In BotFather:
1. `/newapp` (or edit an existing app) → point it at your deployed frontend URL.
2. Set the bot's menu button to open the Mini App (`/setmenubutton`).

The bot's `/start` command also sends an inline "Open App" button directly, and forwards
any referral code passed as `/start CODE` into the Mini App as `startapp=CODE`.

## 5. Admin panel

Visit `/admin/login` on your deployed frontend and sign in with the default admin
credentials from `backend/.env`, then change the password by editing the `admins` table
directly (e.g. with the `sqlite3` CLI or DB Browser for SQLite) or extending the
settings page — a "change password" endpoint isn't wired up yet and would be a good
first addition.

## 6. What's real vs. what's a placeholder

**Fully functional, server-validated, backed by SQLite:** authentication (Telegram
`initData` HMAC verification), tapping/mining with energy regen and anti-cheat rate
limiting, daily rewards with real cooldowns, tasks (complete-once, no duplicate
claims), referrals (self-referral blocked, reward-once, locked at signup), referral
history, referral leaderboard, leaderboards, user profile, and the entire admin panel
(dashboard stats, user search/ban/edit, task CRUD, live settings, broadcast messaging
via the bot, action logs).

**Intentionally a placeholder:** the Wallet page. It shows real balance data but has
no withdrawal, deposit, or blockchain logic — those endpoints return `501 Not
Implemented` on purpose, and the UI shows "Coming Soon" instead of a working withdraw
flow. The response shape (`balance`, `wallet_connected`, `transactions: []`, etc.) is
designed so wiring up real wallet/withdraw/deposit endpoints later won't require
changing the frontend contract.

## 7. Notes on SQLite in production

SQLite handles this app's read/write pattern well at small-to-medium scale (it's set
up with WAL mode for better concurrent access), but it is a single file with
single-writer semantics. If you outgrow it — heavy concurrent write load, need for
replication/backups-while-live, multiple app servers — swapping `DATABASE_URL` for a
networked database is the only change needed at the config layer, since everything
else goes through SQLAlchemy's async ORM rather than raw SQLite-specific calls.

## 8. Before going to real production

This is a solid, working foundation, not an audited, battle-tested payments system.
Before handling real users/money at scale, you'd still want to: add Alembic migrations
(the app currently uses `create_all` for simplicity), add structured logging/monitoring,
back up `tapcoin.db` on a schedule, load-test the tap endpoint and tune the rate limits,
add automated tests, and get a security review of the anti-cheat logic and the admin
panel's auth before opening it to the public internet.
