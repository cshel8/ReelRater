# ReelRater

## Requirements

- Node.js 22
- npm
- Expo Go or an iOS/Android simulator

Node 22 is required for compatibility with this project's Expo SDK version. If you use NVM, select the repository's configured version:

```bash
nvm install
nvm use
```

## Setup

Install the locked dependency versions and start Expo:

```bash
npm ci
npx expo start
```

From the Expo terminal, press `i` to open the iOS Simulator, `a` for Android, or scan the QR code using Expo Go.

## API server

The API is a separate Express application in `server/`. Use Node 22 and install its dependencies independently:

```bash
cd server
npm install
npm run dev
```

The server listens on port `3000` by default. Its public health check is available at:

```text
GET http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok"
}
```

The future AWS Application Load Balancer target group should use `/health` as its health-check path. Application routes will use the `/api/v1` prefix.

Run the server checks with:

```bash
cd server
npm test
npm run build
```

See the [Expo Router documentation](https://docs.expo.dev/routing/introduction/) for routing information.
