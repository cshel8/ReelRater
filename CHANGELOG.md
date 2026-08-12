# Changelog

Concise developer history of meaningful ReelRater architecture decisions,
security changes, backend work, migrations, bug fixes, and feature behavior.

## **2026-08-11 — Community Firestore Index Fix**

### Fixed

- Community feed was unavailable because the active-follow collection-group
  query required a composite Firestore index.
- The required `followers` collection-group index was deployed with
  `followerId` ascending and `status` ascending.
- Community was manually verified to load successfully after the index became
  ready.

### Why

- Community determines the current user's active following relationships using
  both `followerId` and `status`.
- Filtering to `status == "active"` prevents pending private-account follow
  requests from being treated as active follows.

### Verification

- Firestore index reached its usable/ready state.
- Community was manually tested successfully.
- Pending relationships remain conceptually excluded by the active-only query.

### Follow-up

- Firestore security rules remain a separate review/test/deployment task.
- An existing deployed `followers.followerId` field override was discovered
  and preserved during deployment. It was subsequently inspected, confirmed
  as a collection-group ascending override, and represented in local index
  configuration.

## **2026-08-11 — Trusted Social Graph Counters**

### Changed

- `followerCount` and `followingCount` are trusted backend-managed fields.
  Mobile clients may read them but must not directly write them.
- Follow mutations go through the local Express API and Firebase Admin SDK.
  Public follows and approved private follows update counters transactionally;
  pending relationships do not affect counts.
- `/api/v1/social/counters` is new-account initialization only. Existing-user
  reconciliation is a separate Admin-SDK-only maintenance command.
- Reconciliation derives absolute totals from active follow relationships and
  is safe to rerun.
- `followRelationships` remains the source of truth for who follows whom;
  counters are derived summary data, not a replacement for relationship
  documents.

### Verification

- The reconciliation command ran against the intended Firebase project and
  reported 5 profiles scanned, 3 relationships scanned, 3 active
  relationships counted, 5 profiles updated, and 0 dangling relationships.
