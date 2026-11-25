This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Embrace Game WebSocket

Set the public WebSocket endpoint before starting the app to connect the player and watcher screens to the backend:

```env
NEXT_PUBLIC_GAME_WS_URL=wss://your-backend.example.com/game
```

The watcher screen is available at `/pages/embrace-game/watch` and sends `WATCH_GAME` with the watcher ID and room code. Without the environment variable, browser tabs use a local `BroadcastChannel` fallback for development.

## Paid voting

Public voting is available at `/pages/votes`; poll and candidate management is at `/pages/admin/votes`.
See [VOTING_BACKEND_HANDOFF.md](./VOTING_BACKEND_HANDOFF.md) for the implemented voting API contract, database requirements, payment verification, and launch checks. The frontend uses the reported Flutterwave endpoints; live deployment and payment verification still need integration checks.

Run focused checks with `npm run test:voting` (`npm.cmd run test:voting` on Windows).

Voting administration has a dedicated password sign-in at `/pages/admin/votes` using `POST /votes/api/admin/login`. Its session is separate from the original portal admin login at `/pages/login` (`/users/api/login-admin`). Portal and voting logouts are independent.

## Blueprint Studio

Students can open Blueprint Studio from the student portal at `/pages/blueprints`. See the [Blueprint Studio guide](./docs/blueprint-studio.md) for compiler architecture, project storage, deployment and testing.

## Appearance

Use the theme control in the bottom-right corner on any page to switch between light and dark mode. The device icon restores System mode; the admin workspace also has a Light / Dark / System selector in Workspace settings. Preferences are saved in browser storage as `hub-theme` and synchronized between tabs. System mode follows device theme changes. Printed reports and flyer artwork keep their original colors.
