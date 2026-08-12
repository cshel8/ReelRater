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

## Development architecture

ReelRater is an Expo/React Native mobile app backed by Firebase Authentication,
Cloud Firestore, and local SQLite storage for offline review work. A separate
local Express server in `server/` provides trusted server-side operations and
keeps external-service credentials out of the mobile app.

The mobile app reads normal application data from Firestore according to
Firestore Security Rules. Authenticated social mutations—following,
unfollowing, approving or rejecting requests, and removing followers—go
through the Express API, which verifies a Firebase ID token and performs the
operation through Firebase Admin SDK transactions.

`followRelationships` remains the source of truth for who follows whom.
`users/{uid}.followerCount` and `followingCount` are trusted, backend-managed
summary fields: mobile clients may read them but cannot directly write them.
Pending relationships do not affect either count.

Firestore configuration is maintained alongside the app:

- `firestore.rules` defines client authorization.
- `firestore.indexes.json` defines composite indexes and single-field
  overrides.
- `firebase.json` points Firebase tooling at those files and defines the local
  Firestore Emulator.

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
  "ok": true,
  "app": "reelrater",
  "served_by": "api-hostname",
  "time": "2026-07-12T18:30:00.000Z"
}
```

The future AWS Application Load Balancer target group should use `/health` as its health-check path. Application routes will use the `/api/v1` prefix.

### Movie catalog configuration

Movie search is routed through the API server so external catalog credentials
are not bundled into the mobile app. Copy the example environment file once:

```bash
cd server
cp .env.example .env
```

Open `server/.env`, paste TMDB's API Read Access Token after the equals sign,
and then start the server:

```bash
npm run dev
```

The real `.env` file is ignored by Git. Only the blank `.env.example` template
is shared with other developers, who must provide their own local token or use
a deployed API server that already has one configured.

The app defaults to `http://127.0.0.1:3000`, so when using the iOS Simulator,
start Expo normally from the project root:

```bash
npx expo start
```

For a physical device or deployed server, set `EXPO_PUBLIC_API_BASE_URL` to an
address that device can reach. This keeps the app independent from any one API
host without requiring application-code changes.

Until the token is set, movie endpoints return HTTP `503` with the code
`movie_catalog_unavailable`; the health endpoint continues to work normally.

### TMDB attribution

The app's Profile → About & Credits screen contains TMDB's approved logo and
the required notice:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

The local logo asset was downloaded from TMDB's official
[Logos & Attribution](https://www.themoviedb.org/about/logos-attribution) page.
Keep the logo's colors and proportions unchanged. Before a production release,
review the current TMDB API terms again and confirm that ReelRater's intended
use is still non-commercial.

Catalog results in the local SQLite cache become eligible for refresh after
150 days and expire after 179 days. When connectivity is available, cache
maintenance retrieves due entries through the provider-independent movie
catalog contract. Only a successful response replaces an entry and starts a
new retention window; expired entries are removed automatically.

The five most recent reviews can also use managed offline poster files. Poster
metadata is stored separately from reviews, while the image bytes live in
Expo's cache directory. Each file inherits the catalog snapshot's existing
retention window—a later download never restarts the 179-day clock. Expired and
evicted files are deleted, missing files fall back to the normal placeholder,
and new downloads are skipped while the review service is offline. Downloads
must be valid images no larger than 10 MB.

This retention policy currently covers the reusable `cached_movies` catalog
cache. Matched review snapshots now carry the same provider-neutral retention
metadata. Review screens attempt to resolve due snapshots through the catalog
contract, hide expired catalog fields when a refresh is unavailable, and keep
the user's rating and review text intact.

A production deployment still needs backend adapters and scheduling to purge
expired movie fields from shared review documents whose owners do not reopen
the app.

### Backend review-catalog cleanup

The API server contains the deployment-independent cleanup job in
`server/src/reviewCatalogMaintenance/`. It processes due review snapshots in
bounded, paginated batches; refreshes through `MovieCatalogService`; redacts
expired catalog fields when refresh is unavailable; and preserves user-created
review fields through a narrow repository contract.

The job also requires an expiring lease and opaque record versions. These
prevent overlapping backend instances and stale conditional writes from
overwriting newer review data.

The following deployment adapters are intentionally deferred:

- A Firebase Admin implementation of the review maintenance repository.
- A distributed lease implementation, using Firestore or another shared store.
- An AWS EventBridge schedule and private job entry point.

Until those adapters and the schedule are configured, the cleanup core is
tested and buildable but does not run automatically.

Available media endpoints:

```text
GET /api/v1/media/search?query=Arrival&mediaType=movie
GET /api/v1/media/search?query=Dragon%20Ball%20Z%20Kai&mediaType=tv
GET /api/v1/media/{catalogId}
```

The older `/api/v1/movies` route remains available for compatibility while
clients migrate to the media endpoint.

### Account deletion backend

Account deletion uses `DELETE /api/v1/account`. The app reauthenticates the
user, sends a fresh Firebase ID token, and the server deletes Firestore data,
follower relationships, profile images, and Firebase Authentication before the
app clears account-specific SQLite data.

Never put Firebase Admin credentials in Expo environment variables or commit
them to Git. The Express server needs Application Default Credentials, such as
a service-account file mounted from a deployment secret and referenced by
`GOOGLE_APPLICATION_CREDENTIALS`. The adapter also supports
`FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET`.

The mobile app refuses to send an account token to a non-HTTPS remote API.
Localhost HTTP remains available for development.

### Social graph API

The local Express API exposes protected `/api/v1/social` endpoints for normal
social-graph mutations. The app reaches them through `apiBaseUrl`, which
defaults to `http://127.0.0.1:3000` and can later point at a deployed HTTPS
server through `EXPO_PUBLIC_API_BASE_URL` without changing screen code.

For local development, start the Express server before testing follow-related
flows in the app. Media search needs the local TMDB configuration described
above. Trusted social operations and account deletion additionally require the
server to have Firebase Admin Application Default Credentials; keep all such
local configuration outside Git and never expose it to Expo client variables.

Run the server checks with:

```bash
cd server
npm test
npm run build
```

### Trusted social-counter reconciliation

`users/{uid}.followerCount` and `followingCount` are maintained by the
trusted social API during normal relationship changes. Existing profiles can
be repaired or backfilled with a separate Admin SDK maintenance command:

```bash
cd server
npm run reconcile-social-counters
```

Use `npm run reconcile-social-counters -- --batch-size=50` to choose a smaller
scan page. The command requires Application Default Credentials with Firestore
read/write access, plus `FIREBASE_PROJECT_ID` when the default project is not
correct. For a local service-account file, set `GOOGLE_APPLICATION_CREDENTIALS`
to its path before running the command. Never place those credentials in Expo
environment variables or commit them.

The command scans existing `users` documents and relationship documents,
counts only relationships whose status is `active`, and writes absolute totals
to existing profiles. Pending relationships do not count. Its JSON result
reports scanned records, updated/unchanged profiles, and dangling relationships
that referenced a missing profile. Re-running it is safe: it recalculates and
replaces totals instead of applying increments.

If a read or write fails, the command exits non-zero. Earlier profile writes
may already have completed, but a later rerun safely recalculates every total.
Verify completion by checking its JSON output, then inspect representative
`users/{uid}` documents against their active follower relationships. This is an
administrator-only command; it is not exposed through the mobile API and does
not replace the new-account-only `/api/v1/social/counters` initialization route.

## Firestore Emulator security-rule tests

Firestore Security Rules are tested locally with the Firestore Emulator rather
than against the production Firebase project. Run the suite from the repository
root:

```bash
npm run test:firestore-rules
```

The command starts an isolated emulator project named `reelrater-rules-test`,
loads the repository's current `firestore.rules`, runs allow/deny tests, and
then shuts the emulator down. It does not deploy rules or indexes and does not
read or modify production Firebase data.

For a fresh setup, run `npm ci` first. The locally installed Firebase CLI will
download the Firestore Emulator on first use, and the Firestore Emulator
requires a supported Java runtime. No Firebase service-account credential is
required for these isolated Emulator tests.

The suite covers the main authorization boundaries: profiles and trusted
counters, user settings, review visibility and ownership, direct-client
social-mutation denial, public/private follower and following lists, and the
active-only Community following query. The ordinary Expo test command excludes
these Node/Emulator tests; run `npm test` for app tests and the command above
for Firestore rule tests.

See the [Expo Router documentation](https://docs.expo.dev/routing/introduction/) for routing information.
