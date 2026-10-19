# ReelRater Tech Stack

This is a concise reference for the technologies currently used by ReelRater.
For setup, environment variables, and operating instructions, see [README.md](README.md).

## Mobile client

- **Language:** TypeScript
- **Framework:** React Native 0.86 with React 19
- **Runtime/tooling:** Expo 57 and Expo Router
- **Client state:** Zustand
- **Device services:** Expo SQLite, AsyncStorage, NetInfo, FileSystem, Image Picker, and Expo's standard navigation/UI packages

The Expo app is the user-facing iOS, Android, and web client. It reads permitted Firebase data directly and uses the Express API for trusted operations and TMDB-backed catalog data.

## Firebase

- **Authentication:** Firebase Authentication
- **Cloud data:** Cloud Firestore
- **Authorization:** version-controlled `firestore.rules`
- **Query configuration:** version-controlled `firestore.indexes.json`
- **Trusted server access:** Firebase Admin SDK, used only by the Express server and maintenance commands

Firestore is the authoritative cloud store for profiles, reviews, follow relationships, and user settings. `followRelationships` is the social-graph source of truth; `followerCount` and `followingCount` on user documents are trusted server-maintained summaries.

## Local/offline data

- **Database:** Expo SQLite on the device
- **Purpose:** offline review work, pending synchronization operations, and account-scoped cached content such as Community and Home data

Local data improves offline behavior but does not replace Firestore as the cloud authority. Sensitive Community cache content is scoped and invalidated according to the current signed-in account and authorization state.

## Backend API

- **Runtime:** Node.js 22
- **Language:** TypeScript
- **Framework:** Express 5
- **Location:** `server/`
- **Authentication:** Firebase ID tokens verified by the server
- **Trusted operations:** Firebase Admin SDK transactions

The server provides a boundary for TMDB access, trusted social-graph mutations/counters, account deletion, and maintenance commands. The mobile app selects its API endpoint through `EXPO_PUBLIC_API_BASE_URL`; local development normally uses `http://127.0.0.1:3000`.

## External catalog service

- **Provider:** The Movie Database (TMDB) API
- **Access pattern:** the Express server calls TMDB; the mobile client does not hold the TMDB access token
- **Features using it:** media search, details, trending/popular discovery, and personalized recommendations

TMDB-backed recommendations are online-only. The server needs `TMDB_READ_ACCESS_TOKEN` in its uncommitted `server/.env` file.

## Testing and quality tools

- **Client tests:** Jest, `jest-expo`, and React Native Testing Library
- **Server tests:** Node's test runner through `tsx --test`
- **Firestore rules tests:** Firebase Emulator Suite and `@firebase/rules-unit-testing`
- **Static checks:** TypeScript

## Common development commands

From the repository root:

```bash
npm ci
npm run ios                 # Or: npm start
npm test
npx tsc --noEmit
npm run test:firestore-rules
```

From `server/`:

```bash
npm ci
npm run dev
npm test
npm run build
```

The server's TMDB routes require `server/.env`. Trusted Firebase Admin operations additionally require Application Default Credentials; never commit service-account files or credentials.

## Deployment status

Firebase Authentication and Firestore are the cloud services used by the app. The Express API is currently documented and used for local development through its configurable base URL; this repository does not require an AWS runtime for the current application flow.
