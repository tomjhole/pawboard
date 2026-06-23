# PawBoard

**The modern visual booking diary for pet boarding businesses.**

PawBoard replaces the paper diary for kennels, catteries and pet boarding businesses. It is a browser-first, offline-capable SaaS app built with React, TypeScript and Supabase.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- A [Supabase](https://supabase.com/) account and project

---

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Create your Supabase project

1. Sign in at [supabase.com](https://supabase.com/) and create a new project.
2. Once created, go to **Project Settings → API**.
3. Copy the **Project URL** and the **anon public** key.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

> **Important:** Never commit `.env.local` to version control. It is listed in `.gitignore`.

### 4. Start the development server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL. Found in Project Settings → API. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anon (public) key. Found in Project Settings → API. |

All environment variables must be prefixed with `VITE_` to be accessible in the browser via `import.meta.env`.

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

---

## Project structure

```
src/
  components/
    layout/         App shell, sidebar and top bar
    ui/             Reusable design system components
  lib/
    supabase.ts     Supabase client (reads from environment)
    auth.ts         Authentication helper functions
    errors.ts       Error normalisation utilities
  pages/            One file per route
  App.tsx           Router and route definitions
  main.tsx          App entry point
  index.css         Tailwind CSS import
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Backend / Auth | Supabase |
| Database | Supabase Postgres with Row Level Security |
| File storage | Supabase Storage |
| Offline / PWA | Dexie.js + Service Worker (Phase 4) |
| Icons | Lucide React |

---

## Database schema

Migrations live in `supabase/migrations/`. Run them in order against your Supabase project.

### Option A — Supabase Dashboard (simplest)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor**.
3. Paste and run `20260622000000_initial_schema.sql`.
4. Paste and run `20260622000001_rls_policies.sql`.

### Option B — Supabase CLI

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

### Generate TypeScript types

After applying the schema, generate typed client bindings:

```bash
npx supabase gen types typescript --project-id your-project-ref > src/types/database.ts
```

---

## Supabase CLI (optional but recommended)

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) to run migrations locally and manage your project from the terminal:

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
```
