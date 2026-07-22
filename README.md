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
  "ok": true,
  "app": "reelrater",
  "served_by": "api-hostname",
  "time": "2026-07-12T18:30:00.000Z"
}
```

The future AWS Application Load Balancer target group should use `/health` as its health-check path. Application routes will use the `/api/v1` prefix.

### Movie catalog configuration

Movie search is routed through the API server so external catalog credentials
are not bundled into the mobile app. Set TMDB's API Read Access Token in the
server process before starting it:

```bash
export TMDB_READ_ACCESS_TOKEN="your-token"
npm run dev
```

When running that server locally for the iOS Simulator, start Expo from the
project root with:

```bash
EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:3000" npx expo start
```

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

Available movie endpoints:

```text
GET /api/v1/movies/search?query=Arrival
GET /api/v1/movies/{catalogId}
```

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

Run the server checks with:

```bash
cd server
npm test
npm run build
```

See the [Expo Router documentation](https://docs.expo.dev/routing/introduction/) for routing information.
