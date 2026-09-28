# Changelog

Concise developer history of meaningful ReelRater architecture decisions,
security changes, backend work, migrations, bug fixes, and feature behavior.

## **2026-09-27 — Community Offline Cache Persistence Foundation**

### Added

- Added viewer-scoped SQLite Community review snapshots and normalized
  Following/Everyone feed-membership records as a foundation for later offline
  Community work.
- Kept Community cache persistence separate from the My Reviews cache and
  behind a dedicated local repository boundary.
- Community cache storage rejects Only Me/private content and is cleared with
  the owning account's local data.
- Added safe snapshot deserialization that rejects malformed or inconsistent
  cached review/author/visibility metadata before it can reach Community.
- Bounded each viewer's cache to 80 unique review snapshots, with up to 50
  Following and 50 Everyone feed memberships; unreferenced snapshots are
  pruned without removing a review still present in the other feed.
- Added policy primitives for 7-day Public content freshness, 24-hour
  Followers Only content freshness, and 6-hour Followers Only authorization
  validity. Content freshness and authorization validity remain distinct.
- Everyone now caches validated Public Community reviews after successful
  authoritative remote pages and uses eligible saved Public reviews only when
  initial remote loading fails.
- Saved Everyone fallback keeps the existing media filter and sort semantics,
  shows a small offline/saved indicator, and never presents a fake remote
  pagination cursor or offline Follow action.
- Following now caches Public reviews and Followers Only reviews only after
  server-backed active-follow validation and server-backed visibility-aware
  review reads succeed. Firestore local-cache results cannot establish or
  refresh the six-hour protected authorization window; when the server is
  unavailable, Following falls through to SQLite and existing authorization
  expiration continues to govern protected offline visibility.
- Expired or malformed Followers Only authorization hides that review from
  saved Following fallback; its 24-hour content freshness remains a separate
  requirement. Public snapshots may serve both feeds for the same viewer
  without duplicating payload data.
- A successful self-unfollow now immediately removes that viewer's protected
  cached content for the author and removes the author from Following cache
  membership. Public snapshots remain when referenced by Everyone; local
  cleanup failures do not undo the successful remote mutation and fail closed
  for the current session instead.
- Successful sign-out clears the signing viewer's Community snapshots and feed
  memberships without touching another viewer's rows. Account deletion retains
  its existing local Community cleanup. Remote relationship or review changes
  made elsewhere still require later reconnect reconciliation.
- Added reconnect reconciliation without new remote infrastructure. It uses
  server-authoritative relationship checks as the privacy priority, purging
  protected cache after authoritative relationship loss and refreshing the
  six-hour authorization only after an active server result. Each reconnect
  deterministically revalidates at most 20 cached reviews: protected entries
  first, then oldest content validation time, then review ID. Authoritative
  unreadability removes stale local content; transport failures do not extend
  authorization or validation. Community tab-return behavior remains separate.

### Scope

- Everyone and Following saved snapshots are bounded, not archives. This work
  does not add cache-first rendering, continuous while-online reconciliation,
  remote push/background jobs, or Community tab-return refresh behavior.
- Expo Go could not cold-launch this development project with the Mac/network
  completely offline; this is a development-environment limitation, not
  evidence that ReelRater persistence failed. Warm-session fallback testing
  and automated persistence tests provide the current offline evidence.
- Checkpoint 6 automated reconciliation validation passed. Its two-session
  runtime test remains deferred: cache a Maya Followers Only review as Connor,
  remove Connor as Maya from another authenticated session, reconnect Connor,
  then verify the protected review cannot return after going offline again.

## **2026-09-26 — Community Everyone Public Feed Checkpoint**

### Added

- Added Community's real Everyone discovery feed for public reviews only, with
  server-side media filtering and sorting, deterministic cursor pagination,
  deduplicated author hydration, and protected batched relationship-status
  lookup for Follow, Following, and Requested presentation.
- Everyone search is intentionally disabled with a clear "Global Community
  search coming soon" message until the dedicated search checkpoint.
- Deployed the required Everyone Community Firestore indexes in a controlled
  indexes-only deployment. Obsolete intermediate rating indexes were removed;
  final rating indexes support rating → movieTitle A-Z → newest `createdAt`
  → deterministic document-ID ordering and were runtime-tested successfully.
- Own public reviews remain visible in Everyone without a self-follow control.
- Highest and Lowest rating ties now use rating → title A-Z → newest review,
  with deterministic document-ID pagination ties.

### Scope

- Following remains on its existing privacy-safe feed architecture. Firestore
  rules were not redeployed as part of the indexes-only deployment, and no
  server or Firebase data changed remotely.

## **2026-09-26 — Community Concept C Presentation Checkpoint**

### Changed

- Began Community's Concept C detailed/social presentation with a shared
  author-and-media review card, persistent Following | Everyone control,
  Concept C-style search/filter header, and spoiler/empty-state treatments.
- Following remains the privacy-aware feed of reviews from active followed
  authors. Everyone is deliberately reserved for broader public discovery in
  the next checkpoint and is not populated with Following data.
- Spoiler conceal/reveal remains local and transient: revealing review text
  does not change the review or persist a viewer preference.

## **2026-09-26 — Firestore Rules Deployment Checkpoint**

### Deployed

- Released the reviewed strict review-schema and social-list Firestore rules
  to production.
- Public Followers and Following lists are now available to signed-in users.
- Private Followers and Following lists are available only to owners and
  active followers; pending and unrelated viewers remain denied.
- Ordinary matched-review edits preserve stable catalog identity in production.

### Scope

- This deployment aligned production rules with the already-reviewed local
  privacy and review policy. It did not introduce a new social architecture,
  deploy indexes, or migrate existing review data.

## **2026-09-26 — Historical Orphaned Social Relationship Maintenance**

### Added

- Added an administrator-only Firebase Admin maintenance command that detects
  social relationships whose follower or followed profile was historically
  deleted outside ReelRater.
- The command is dry-run by default; deletion requires explicit
  `--delete-orphans` opt-in and revalidates every relationship before removal.
- Existing trusted social-counter reconciliation remains the follow-up step
  for rebuilding survivor counts from absolute active-relationship totals.

### Scope

- This addresses historical manually deleted accounts only. The current
  retry-safe ReelRater account-deletion workflow remains responsible for
  normal relationship cleanup.

## **2026-09-25 — Retry-Safe Account Deletion**

### Fixed

- Account deletion now cleans up account-owned Firestore data by owner ID, so a
  retry can continue even if an earlier attempt already removed the profile.
- Missing Firestore resources, an empty Storage prefix, and an already-deleted
  Firebase Auth user are treated as completed states where safe.
- Active social relationships and surviving follower/following counters remain
  transactionally paired, preventing a retry from decrementing a counter twice.
- Incomplete remote cleanup now returns an explicit retryable result instead
  of implying that no remote deletion occurred.

### Client behavior

- User-owned local review data and per-user Community preferences are cleared
  only after remote deletion completes.
- If remote deletion completes but local cleanup fails, the user is still
  signed out and returned to Login with an accurate device-cleanup notice.
- Authenticated incomplete-profile users now have the same secure,
  password-confirmed account-deletion exit path without recreating a profile.
- Complete Profile scrolling now accommodates the expanded onboarding form.
- Account deletion now cleans only active configured persistence providers;
  Firebase Storage is not part of ReelRater's current architecture. A future
  provider-specific user-asset cleaner can participate without coupling the
  account lifecycle to Firebase Storage.

### Architecture

- Firestore, Firebase Storage, and Firebase Auth remain separate systems and
  cannot be deleted in one global transaction; the workflow is therefore
  intentionally idempotent across those stages.

## **2026-09-23 — My Reviews Remote Read Reliability**

### Fixed

- My Reviews now attempts its Firestore read even when NetInfo temporarily
  reports the device as offline or unreachable.
- SQLite remains the fallback only when the actual remote read fails.
- My Reviews reloads once when connectivity transitions from offline to online.
- The offline banner now reflects an actual remote fallback rather than a
  NetInfo false negative alone.

### Preserved

- Pending review writes and synchronization retain their existing
  connectivity safeguard.
- Authoritative empty remote results and deserialization-failure cache safety
  remain distinct.

### Verification

- `npx jest --runInBand --no-watchman` passed: 43 suites, 208 tests.
- `npx tsc --noEmit` passed.
- `npm run build` passed in `server/`.
- No Firestore rules, indexes, Firebase configuration, production data, or
  deployments were changed.

## **2026-09-23 — Legacy Review Read Compatibility**

### Fixed

- Firebase review reads now normalize the exact legacy rating strings `"1"`
  through `"5"` to ReelRater's numeric domain ratings.
- New and edited review writes remain strict numeric whole-star ratings; no
  remote review documents were migrated, rewritten, or deleted.
- A Firestore query that returns one or more unreadable review documents is no
  longer treated as an authoritative empty result, so valid local cached
  reviews are preserved. A genuine zero-document result still refreshes the
  cache to empty.

### Compatibility

- Legacy reviews without `spoilerWarning`, with ISO catalog-retention values,
  or without a complete catalog snapshot continue to use their existing safe
  read fallbacks.

### Verification

- `npx jest --runInBand --no-watchman` passed: 43 suites, 205 tests.
- `npx tsc --noEmit` passed.
- `npm run build` passed in `server/`.
- No Firestore rules, indexes, Firebase configuration, production data, or
  deployments were changed.

## **2026-09-23 — Strict Review Schema Validation**

### Security

- Added strict Firestore validation for review documents and nested catalog
  snapshots.
- Unknown review, movie, and catalog-retention fields are rejected.
- Ratings must be numeric whole integers from 1 through 5.
- Review text is required and limited to 3,000 characters; the client/service
  layer continues to reject whitespace-only text before persistence.
- `spoilerWarning` is required and validated as a boolean.
- Manual and matched catalog snapshots are validated separately.
- Matched catalog identity is immutable once established.

### Architecture

- Manual → matched remains an allowed future user-confirmed transition.
- Stable matched identity consists of `catalogId`, `mediaType`, and
  `reviewTargetType`; refreshable metadata may change without changing it.
- Ordinary matched-review edits retain the existing catalog snapshot; they
  update review content/settings rather than changing or downgrading the
  reviewed media identity.
- `createdAt` remains immutable and compatible with offline creation.
- `updatedAt` is schema-reserved for user-edit semantics without introducing
  the future UI feature in this checkpoint.

### Testing

- Firestore Emulator rules tests passed locally: 3 suites, 34 tests.
- Focused review persistence/UI tests passed: 8 suites, 46 tests.
- No Firebase rules or index deployment was performed.

### Follow-up

- Atomic cross-device matched-review uniqueness remains a separate
  trusted-backend task.
- User-facing manual-review matching and notification flows remain future
  work.
- Legacy remote test reviews that do not meet this schema must be recreated
  or migrated before eventual production rules deployment.

## **2026-09-05 — Review Persistence Format Alignment**

### Changed

- Review ratings are now represented and persisted as whole numeric values from
  1 through 5 instead of strings.
- New and edited reviews validate their rating, non-empty title, non-empty
  review text, spoiler-warning value, and the approved 3,000-character review
  text maximum before local or remote persistence.
- New Firebase review writes store matched catalog-retention timestamps as
  Firestore `Timestamp` values.

### Architecture

- The provider-neutral review model and SQLite/offline workflow continue using
  plain TypeScript values and ISO timestamp strings.
- Firebase-specific serialization converts catalog-retention ISO values to
  Firestore timestamps on write and converts Firestore timestamps back to ISO
  strings on read, so Firebase types do not leak into the application domain.
- SQLite schema version 11 migrates cached review ratings from `TEXT` to
  `INTEGER`; existing valid legacy ratings are retained as integers, while
  malformed cache rows are excluded until their remote source can refresh them.

### Verification

- `npx jest --runInBand --no-watchman` passed: 42 suites, 173 tests.
- `npx tsc --noEmit` passed.
- `npm run build` passed in `server/`.
- No Firestore rules, indexes, Firebase configuration, production data, or
  deployments were changed.

### Follow-up

- The stricter Firestore review-schema rules can now require numeric ratings
  and Firestore timestamp retention fields without conflicting with new client
  writes. Those rules remain a separate, not-yet-deployed security task.

## **2026-08-17 — Review Spoiler Warnings**

### Added

- Reviews now support a user-controlled `spoilerWarning` boolean.
- New reviews default to `false`.
- Users can mark or unmark their own reviews as containing spoilers.
- Spoiler-marked review text is concealed from other users until deliberately
  revealed.
- The field participates in the existing offline-first
  persistence/synchronization workflow.
- Catalog/TMDB metadata refresh does not control or overwrite the spoiler
  setting.

### Architecture

- `spoilerWarning` is review-owned user content, not catalog metadata.
- It will be included in the future strict Firestore review-field allowlist.
- In that future strict schema, new reviews will require it to be a boolean.
- Changing the spoiler setting counts as a manual edit for the planned
  `updatedAt` behavior.

### Verification

- `npx jest --runInBand --no-watchman` passed: 42 suites, 166 tests.
- `npx tsc --noEmit` passed.
- No Firestore rules, indexes, Firebase configuration, or deployments were
  changed.

## **2026-08-13 — Manual Review Catalog Matching Decision**

### Decision

- ReelRater will continue allowing users to create manual reviews when a
  catalog/TMDB match is unavailable, including while offline.
- A manual review must not be silently or automatically converted into a
  matched catalog review when connectivity returns.
- When connectivity becomes available, ReelRater may eventually alert or
  prompt the user that a manual review could potentially be matched.
- The user must explicitly select and confirm the correct movie or TV show
  before the review becomes catalog-matched.
- This avoids incorrect automatic matches for ambiguous titles, remakes,
  similarly named works, or different media types.

### Intended Matching Flow

Manual review
→ connectivity/catalog search becomes available
→ optional in-app prompt/notification that matching is available
→ user reviews catalog search results
→ user explicitly selects the correct title
→ duplicate-target validation occurs
→ manual review transitions to matched
→ stable catalog identity becomes locked

### Catalog Identity Rule

- `manual → matched` should eventually be supported as an explicit,
  user-confirmed transition.
- Once matched, the stable catalog identity must not be allowed to change to
  another target.
- A matched review must not be converted back to manual simply by editing its
  title.
- The stable identity consists of `catalogId`, `mediaType`, and
  `reviewTargetType`.
- Refreshable catalog metadata may continue changing without changing target
  identity, including display/catalog title, release year, genres, poster
  information, and catalog retention/refresh timestamps.

### Current Implementation Status

- Offline/manual review creation already works.
- Existing matched reviews already support catalog metadata refresh.
- Manual reviews do **not** currently transition to matched reviews through
  the normal product flow.
- Established matched identity is **not** yet fully protected against target
  changes.
- The user-confirmed manual-to-matched workflow and immutable matched
  identity remain future implementation work.

### Duplicate Protection

- A manual → matched transition must perform duplicate-target validation
  before completing.
- Existing local duplicate protection is not sufficient as the final
  cross-device guarantee.
- A planned trusted, atomic matched-review uniqueness mechanism should
  eventually protect both creation of a new matched review and conversion of
  an existing manual review into a matched review.

### Notifications

- A future notification or in-app alert system may notify users when a manual
  review can potentially be matched after connectivity returns.
- It must invite the user to perform the match; it must not perform the match
  automatically.
- This can eventually fit into ReelRater's broader notification system,
  alongside social notifications such as new followers, follow requests, and
  request approvals.
- Notifications are not part of the current review-schema/security work.

### Current Schema Decisions

- Rating is required and must be a whole integer from 1 through 5.
- Zero-star and half-star ratings are not currently supported.
- Review text is required and must contain non-whitespace content.
- Maximum review-text length will be 3,000 characters.
- These are approved product/schema decisions that still need consistent
  enforcement by the client and Firestore rules where not already enforced.

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

## **2026-08-06 — TV-Series Reviews and Community Preferences**

### Added

- Expanded review targets from movies to include TV series.
- Added Community media filtering, sorting, session state, and persisted
  Community preference defaults.
- Added public-profile review pages, public review details, and paginated
  profile-review loading.
- Added a local review-target identity index to prevent same-device duplicate
  matched reviews.

### Architecture

- Review and catalog contracts became media-aware while retaining support for
  existing movie reviews.
- Local duplicate protection was a device-level safeguard, not authoritative
  cross-device uniqueness.

## **2026-07-22 — Account Deletion and Offline Navigation Hardening**

### Added

- Added protected account-deletion routes and Firebase Admin-backed account
  cleanup infrastructure.
- Added client-side local account-data cleanup after deletion.

### Changed

- Improved offline review handling, review screens, profile navigation, and
  tab reset behavior.

### Architecture

- Account deletion established an early protected Express/Admin SDK operation;
  it was distinct from the later trusted social-mutation backend architecture.

## **2026-07-22 — Expo SDK Modernization**

### Changed

- Modernized the Expo project through SDK 53, 55, 56, and 57 across several
  deliberate platform-compatibility commits.
- Updated Expo Go, Metro, native configuration, dependencies, and SQLite/
  offline persistence compatibility as required by the upgrades.

## **2026-07-21 — TMDB Catalog Integration and Offline Media Retention**

### Added

- Added the initial local Express/TMDB catalog integration and provider-neutral
  catalog contracts.
- Added catalog-aware reviews, local movie metadata caching, poster-file
  caching, retention windows, refresh handling, and cleanup-job support.
- Added TMDB attribution assets and catalog/retention test coverage.

### Architecture

- Established an offline-capable catalog layer for movie reviews. Later TV
  support, Firebase serialization hardening, and strict review-schema rules
  were not part of this milestone.

## **2026-07-19 — Social Reviews, Profiles, and Offline Sync Foundation**

### Added

- Added complete-profile onboarding, display names, normalized handle claims,
  profile discovery, and review visibility settings.
- Added Community, profile, follower/follow-request, review write, review
  detail, and review-list experiences.
- Added SQLite cached reviews, pending review operations, and synchronization
  services for offline review work.

### Architecture

- Social mutations at this stage used the client-side Firebase architecture of
  the time; the later Express/Admin SDK social mutation model did not yet
  exist.

## **2026-07-13 — Express API and AWS Development Foundation**

### Added

- Added the initial TypeScript Express server, development health endpoint,
  API base configuration, and AWS/EC2 status integration.

### Architecture

- Established a backend/API development boundary without implying the later
  account, social, catalog, or trusted-counter backend capabilities.

## **2026-02-05 — Firebase Authentication Persistence and Early Reviews**

### Added

- Added Firebase configuration, authentication-oriented routing, user state,
  early review screens, and initial test coverage.
- Configured Firebase Auth persistence with AsyncStorage so sessions survived
  app restarts.

### Architecture

- This preceded the later social-privacy model, SQLite review synchronization,
  TMDB integration, and strict Firestore review validation.

## **2026-01-26 — Expo Foundation and Initial Application Structure**

### Added

- Created the Expo foundation and early login, signup, profile, and reviews
  screens.
- Added generated iOS/Android project configuration, application assets, and
  initial TypeScript configuration.

### Changed

- Fixed project configuration for iOS Simulator compatibility and established
  strict TypeScript/path-alias development settings.
