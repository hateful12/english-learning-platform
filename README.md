# English Learning Platform

A simple platform for an English teacher to share **homework**, **lesson links**, **Miro boards**, and **payment information** with students. Students see everything on one page; the teacher manages content via a password-protected dashboard.

## Features

- **Students**: One page with homework, lesson links, Miro links, and payment info.
- **Teacher**: Log in with a password to add, edit, and delete homework, lesson links, Miro links, and payment details.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `TEACHER_PASSWORD` — password for teacher login (e.g. `mypassword`).
   - `NEXTAUTH_SECRET` — any random string for session signing (e.g. `openssl rand -hex 32`).

3. **Database**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open the URL Next.js prints (e.g. [http://localhost:3000](http://localhost:3000)). Students use the home page; the teacher goes to **Teacher login** (or `/teacher`), enters the password, then uses the dashboard.

## Troubleshooting

- **404 on `/` or missing `main-app.js` / `layout.css`**  
  Another process may be using port 3000, so the app might be on **port 3001**. In the terminal where you ran `npm run dev`, check the line like `Local: http://localhost:3000` (or `3001`). Open that exact URL.

  If the correct port still shows 404 or “missing required error components”:
  1. Stop the dev server (Ctrl+C).
  2. Delete the build cache: `npm run clean` (or remove the `.next` folder by hand).
  3. Start again: `npm run dev`.

- **Port already in use**  
  Stop any other Node/Next process using port 3000, then run `npm run dev` again so the app can bind to 3000.

## Tech

- **Next.js 14** (App Router), **TypeScript**, **Tailwind CSS**
- **Prisma** + **SQLite** (file-based, no extra DB setup)
