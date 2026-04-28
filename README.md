# FYPConnect Backend

This folder contains the TypeScript backend for FYPConnect. It provides the API used by the frontend for authentication, email verification, profile setup, discovery, matching, chat, and safety actions such as blocking or deleting an account.

The backend is built around Express route/controller/query layers, with Prisma used for PostgreSQL database access.

## Related Repository

This backend powers the FYPConnect frontend:

[View the frontend repository](https://github.com/AbdullahAhmed6859/fypconnect-frontend)

## Tech Stack

- Node.js with TypeScript
- Express 5 for the HTTP API
- Prisma with PostgreSQL
- Cookie-based authentication
- `jose` for JWT handling
- `bcrypt` for password hashing
- `nodemailer` for verification emails
- `node-cron` for scheduled cleanup of unverified accounts
- `pino` and `morgan` for logging

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local `.env` file using `example.env` as the template:

```text
DATABASE_URL=
EMAIL_USER=
EMAIL_PASS=
NODE_ENV=
LOG_LEVEL=
```

Generate or update the Prisma client after database/schema changes:

```bash
npx prisma generate
```

Start the development server:

```bash
npm run dev
```

By default, the API runs on:

```text
http://localhost:5000
```

The frontend is expected to run from `http://localhost:5173`, which is currently allowed in the CORS configuration.

## Useful Scripts

```bash
npm run dev    # Run the TypeScript server with nodemon + tsx
npm run build  # Compile TypeScript into dist/
npm start      # Run the compiled server from dist/
```

## Folder Guide

```text
src/
  app.ts        Express app setup, middleware, routes, and server startup
  controllers/ Request/response handlers for each feature area
  queries/     Database-facing logic used by controllers
  routers/     Express route definitions grouped by feature
  middleware/  Auth protection and rate limiting
  db/          Prisma client setup
  utils/       JWTs, logging, responses, errors, and email helpers
  cronJob/     Scheduled cleanup tasks

prisma/
  schema.prisma Database models and Prisma client configuration

scripts/
  ddl.sql       SQL schema/reference script
```

## API Areas

All main routes are mounted under `/api/v1`.

```text
/auth       Register, login, logout, email verification, protected test route
/profile    Profile setup, profile retrieval, profile updates, preferences
/discovery  Browse/discovery profile feed
/browse     Like or pass on another user
/matches    Active matches and updated match profile notifications
/chat       Conversation history and sending messages
/safety     Restrict, unrestrict, end matches, list restricted users, delete account
```

Protected routes use the `protect` middleware, so they require a valid authenticated session.

## Database Notes

The Prisma schema models users, majors, years, skills, interests, profile preferences, likes, passes, matches, messages, notifications, and restricted users. In practical terms:

- a user must verify their email before becoming active;
- a completed profile is needed before browsing/matching;
- mutual likes create matches;
- messages belong to matches;
- safety actions can block, unblock, unmatch, or delete accounts.

## Notes for Studying the Code

- Start with `src/app.ts` to see global middleware and how routers are mounted.
- Open files in `src/routers` to see the public API surface.
- Then follow each route into `src/controllers` and `src/queries` to understand the request flow.
- Check `src/middleware/auth.ts` for how protected routes identify the current user.
- Check `prisma/schema.prisma` when you need to understand the data relationships behind a feature.
