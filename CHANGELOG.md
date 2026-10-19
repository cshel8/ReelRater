# Changelog

Concise developer history of meaningful ReelRater architecture decisions,
security changes, backend work, migrations, bug fixes, and feature behavior.

## **2026-10-18 — Home Checkpoint 6: Home Search**

### Added

- The Home header's search icon now opens a dedicated Search screen in the
  Home stack: an auto-focused field with a clear action, a 300ms debounce,
  and a request-ID guard so a superseded query's late responses are always
  discarded — a new query never shows the previous query's results.
- Searches reuse the existing cache-aware catalog service with two parallel
  TMDB requests (up to 10 movies and 10 TV shows, no pagination), rendered as
  labeled Movies and TV Shows sections with rounded posters, titles, and
  type/year metadata. Selecting a result opens the reusable Media Details
  screen; returning preserves the query and results, while leaving the Home
  tab dismisses Search per the existing tab-reset behavior.
- Honest availability states: cache-fallback results (identified by their
  retention metadata) and offline sessions show a "results may be
  incomplete" notice; an empty response is labeled "No results" only after a
  successful probe of the API's existing /health endpoint confirms the
  catalog was reachable — otherwise a retryable unavailable/offline message
  is shown instead. Result posters reuse already-cached image files without
  adding transient downloads to the Home image cache (new opt-out
  `allowDownload` prop on the shared cached-image component).

### Changed (post-review refinements)

- Home search is now inline instead of a separate screen: the header icon
  expands an auto-focused field beneath the header (icon becomes a close
  action), the normal feed stays visible until a query is entered, a query
  swaps in the full-height Movies/TV results, and closing search restores
  the feed. All CP6 search behavior (debounce, stale-response protection,
  offline cache handling, error/retry states, details navigation with
  query/results preserved on return) carries over unchanged; leaving the
  Home tab clears search.
- An experimental instant tab-switching change (Home opting out of the
  navigator's animated popToTopOnBlur in favor of its own instant stack
  reset on tab blur) was reverted after Simulator testing showed slower,
  more distracting transitions than the original behavior. Home uses the
  standard popToTopOnBlur handling again; the tab-blur scroll reset and
  search dismissal remain.

### Scope

- No server, schema, contract, or dependency changes beyond the additive
  client-side health probe helper and image-component prop. Community and
  Reviews search behavior is untouched.

## **2026-10-18 — Home Checkpoint 5: Reusable Media Details Screen**

### Added

- A reusable cinematic details screen for movies and TV series, reached from
  the Home hero (whole slide plus a new pink Concept B "View Details" button)
  and from Popular Movies / Popular TV poster taps. It shows the backdrop
  with the established gradient, an overlapping poster, title, Movie/TV
  Series chip, genres and year, a pink-starred TMDB rating when available,
  and the synopsis.
- Details render instantly from the already-loaded item passed through
  navigation, then enrich through the existing cache-aware
  `mediaCatalogService.getById`. Offline, saved metadata and the cached
  synopsis stay visible with the standard saved-content note; images reuse
  the persistent Home image cache; ratings are online-only and simply hidden
  when unavailable; with no data at all the screen shows a retryable error
  state.
- Additive catalog contract change: `getById` details responses now include
  the optional `backdropUrl` and a `rating` (TMDB vote average, with unrated
  titles reported as no rating). No new endpoints, caching, or schema.
- Home now resets its scroll position only when leaving the Home tab, so
  returning from Media Details preserves the scroll position and current
  hero slide; hero auto-rotation pauses while Details is open and resumes on
  return.

### Changed (post-review polish)

- The synopsis now sits in a white, softly shadowed card under a "Synopsis"
  heading. The screen distinguishes three states: an available (possibly
  cached) synopsis shows in the card even when the server is unreachable; a
  successful response with no synopsis shows a neutral "No synopsis
  available."; and a failed, uncached request shows the pink banner "Connect
  to the internet to load this synopsis." instead of the card — a failed
  request is never mislabeled as a missing synopsis. Review Details'
  pink-tinted container is untouched.
- Removed the hero's "View Details" button; tapping anywhere on a hero slide
  still opens details, and arrows, swiping, dots, auto-rotation, and
  pause/resume behavior are unchanged.
- Fixed an offline mislabel: titles whose metadata was seeded by Home browse
  caching (but whose synopsis was never fetched) showed "No synopsis
  available." offline. Cache-sourced details are identified by their existing
  retention metadata, so an unverified empty synopsis now shows the pink
  "Connect to the internet" message; "No synopsis available." is reserved for
  fresh catalog responses that confirm the synopsis is genuinely absent.

### Scope

- Home search and "Recommended for You" remain deferred. No Community,
  Reviews, Profile, authentication, privacy, or Firebase changes.

## **2026-10-18 — Home Checkpoint 4: Cinematic Home Screen**

### Added

- Replaced the placeholder Home tab with the approved Concept B cinematic
  design: a ReelRater-branded header with a search icon (disabled until Home
  search ships), a paged full-bleed Trending Now hero with backdrop images,
  scrim, and pagination dots, followed by Popular Movies and Popular TV
  horizontal poster rows in the app's established light/pink styling. No
  greeting, profile avatar, duplicate trending row, or personalization claims.
- Home now renders through the snapshot-backed feed service: cached sections
  appear immediately, online refreshes respect the existing freshness window,
  pull-to-refresh forces one, and a screen-scoped connectivity listener
  reloads sections when the device comes back online without duplicating the
  tab layout's global reconnect work.
- Hero backdrops and row posters render through the persistent Home image
  cache (local file first, then the remote URL, then a pink placeholder), so
  previously viewed artwork works offline and missing images never hide
  cached titles. Stale image cleanup runs after each section load.
- Intentional states: loading skeleton, a subtle "showing saved content"
  banner when a refresh fails but cached content exists, and a dedicated
  empty state with retry for a first launch offline.
- Converted the Home route to a nested stack (`app/(tabs)/home/`) matching
  the Community/Profile pattern, ready for the media-details and search
  screens in the next checkpoints. The Home status bar switches to light
  content only while the cinematic hero is focused.

### Changed (hero visual refinement)

- Reduced the hero from 440pt to 320pt so sections are visible on first
  paint, and tightened the label/title/meta spacing and pagination-dot
  placement for a closer visual hierarchy.
- Replaced the stacked translucent overlay views (which produced visible
  horizontal bands) with smooth top and bottom smoothstep gradients rendered
  from a tiny embedded PNG — no new dependency — plus a uniform dim layer so
  text and the header stay legible over both bright and dark backdrops.
- Moved the Home header into the native stack header used by the other tabs:
  the ReelRater wordmark sits on the left and the disabled search icon on the
  right, vertically centered beneath the iOS status bar, with the hero
  starting immediately below. The status bar keeps standard dark content over
  the white header, and the hero's top gradient was softened accordingly.

### Changed (carousel controls)

- The Trending Now hero gained subtle edge arrows (translucent circles
  legible over bright and dark backdrops) and automatic rotation every 15
  seconds with looping. Manual arrow taps and swipes reset the timer, and
  rotation pauses while the user is dragging, when Home loses focus, or when
  the app is backgrounded, resuming when Home is active again. Swiping and
  pagination dots are unchanged, and cached/offline content rotates
  identically.
- EXPERIMENTAL (pending review): Popular Movies and Popular TV headings
  gained small back/forward arrows that page the row about one viewport at a
  time; each arrow disables at its end of the row and both hide when the
  content fits. Swipe scrolling, poster dimensions, and layout are unchanged,
  and the controls are isolated in one subcomponent for easy removal.

- A compact "Welcome back, [name]!" greeting between the hero and Popular
  Movies was trialed from the existing persisted user store and reverted the
  same day after Simulator review — the cinematic design reads better without
  it. Home ships without a greeting, matching the approved design decisions.

### Scope

- Media details and Home search are intentionally deferred to the next
  checkpoints; the hero is not yet tappable and the search icon is disabled.
  No Community, Reviews, Profile, authentication, or Firebase changes.

## **2026-10-18 — Home Checkpoint 3: Persistent Home Image Cache**

### Added

- Added a persistent Home image cache for poster and backdrop files, kept
  fully separate from the Reviews poster cache: entries are matched by exact
  source URL (so routine snapshot refreshes never re-download unchanged
  images), capped at 80 files with least-recently-used eviction, and expired
  after 30 days without access, with an orphaned-file sweep during purges.
- Downloads reuse the existing hardened image file-store logic (atomic
  temp-file move, HTTP/MIME validation, 10MB per-file cap, failure cleanup)
  via a new directory-parameterized factory; the Reviews poster store keeps
  its original directory and behavior. Home files live in their own
  `reelrater-home-images` cache directory and survive app restarts.
- Image resolution is single-flight per source URL, self-heals metadata rows
  whose files are missing on disk, and returns null on any failure so Home can
  fall back to the remote URL or a placeholder — cached Home metadata stays
  usable even when images are unavailable.
- Metadata persists in the `cached_home_images` table created by migration
  v13; no new schema changes were needed.

### Scope

- Service layer only; the Home UI will adopt this cache in the next
  checkpoint. No Reviews, Community, Firebase, or schema behavior changes.

## **2026-10-18 — Home Checkpoint 2: Client Browse Service and Offline Snapshots**

### Added

- Added a provider-neutral `MediaBrowseService` contract and its HTTP
  implementation for the new trending/popular endpoints, including optional
  `backdropUrl` parsing for the Home hero. Search and details parsing are
  unchanged apart from reusing the shared response readers.
- Added a snapshot-backed `homeFeedService` for Home discovery sections
  (trending, popular movies, popular TV): successful remote results replace a
  per-section SQLite snapshot atomically; failures fall back to the stored
  snapshot with an explicit `remoteError`; concurrent loads of a section share
  one in-flight request; a 15-minute freshness window avoids redundant
  refetches. Home snapshots hold public, non-personalized catalog data and are
  intentionally not account-scoped.
- SQLite migration v13 (additive only): `home_section_snapshots`,
  `cached_home_images` (metadata table for the upcoming Home image cache), and
  a nullable `overview` column on `cached_movies`.
- The movie cache now stores catalog overviews when details are fetched and
  preserves them when later search/browse writes omit them, so offline details
  can include a synopsis instead of always clearing it. Home browse results are
  also written through the existing movie cache for offline details support.
- `MediaSummary` gained an optional `backdropUrl`; review media snapshots
  explicitly exclude it, leaving review persistence unchanged.

### Scope

- No UI changes yet; the Home screen itself and the Home image cache service
  arrive in later checkpoints. No Firebase, Firestore rules/index, or
  Community/Reviews behavior changes.

## **2026-10-18 — Home Checkpoint 1: TMDB Browse Endpoints**

### Added

- Extended the server's provider-neutral media catalog boundary with browse
  retrieval: weekly trending movies plus popular movies and popular TV, backed
  by TMDB's trending/popular endpoints through the existing authenticated
  request, configuration, and genre-mapping logic.
- New public API endpoints on the modern media router only:
  `GET /api/v1/media/trending` and
  `GET /api/v1/media/popular?mediaType=movie|tv`, each returning
  `{ items: MediaSummary[] }` with an optional bounded `maximumResults`
  (1–20) and the established catalog error responses. The legacy
  `/api/v1/movies` router surface is unchanged.
- Browse results now include an optional `backdropUrl` (preferring TMDB's
  `w780` backdrop size) for the upcoming Home cinematic hero; search and
  details responses are unchanged.

### Scope

- Server-only change for the Home feature. No client, Firebase, Firestore
  rules/index, or SQLite changes in this checkpoint.

## **2026-10-12 — Community Navigation State Refinement**

### Changed

- Community now preserves search, selected-media, scroll, and spoiler state
  while navigating to and back from nested Review Details.
- Leaving Community for another main tab clears only temporary Community
  search state, resets the list position, reconceals spoilers, and refreshes
  the retained Following or Everyone view safely on return.
- Preserved the exact Community list position for ordinary, keyword-search,
  and selected-media views when returning from nested Review Details by
  restoring immediately as Community regains focus, before the outgoing
  detail transition reveals it. Cancelable post-interaction and content-size
  fallbacks remain for lists that are not ready, while hidden-list scroll
  events remain ignored.
- Community now blurs its search input when a user begins dragging results or
  opens Review Details so iOS hardware-keyboard focus cannot remain active
  during nested navigation; blurring does not clear the current search.
- Returning from another main tab now restores the same account's most recent
  authoritative, unsearched Following feed immediately while its normal focus
  refresh runs, instead of briefly presenting keyword-search results as the
  ordinary feed. Unsafe cache-only or authorization-invalidated snapshots are
  not restored.
- Removed the deferred Everyone review-text unavailable message; Everyone
  now shows catalog suggestions without implying global text search exists.

## **2026-10-12 — Community Search Organization Refinement**

### Changed

- Grouped catalog suggestions into independently expandable Movies and TV
  Shows sections, initially showing up to three relevant results per type.
- Kept Following review-text matches visibly separate beneath catalog
  suggestions. Everyone omits that section because global review-text search
  is intentionally deferred.
- Clearing a selected title now exits Community search and returns to the
  ordinary feed without changing the user's scope, filter, or sort preference.

## **2026-10-12 — Community Search Exact-Media UI Integration**

### Added

- Connected selected movie and TV catalog suggestions in Community to the
  existing exact-media retrieval service for both Following and Everyone.
- A selected title now keeps its stable catalog identity while scope and sort
  preferences change, shows an explicit selected-media card, and clears back
  to catalog suggestions when the user changes the search.
- Everyone exact-media results retain cursor pagination; Following remains a
  bounded, active-follow-authorized result set. Exact-media searches remain
  online-only and do not fall back to saved Community snapshots.

### Scope

- Global Everyone review-text search and the later two-section result design
  remain deferred. This checkpoint does not change Firestore rules, index
  configuration, SQLite schema, or Community cache policy.

## **2026-10-11 — Community Search Exact-Media Retrieval Foundation**

### Added

- Added provider-neutral, exact matched-media retrieval services for Community
  Search without integrating the new retrieval into the Community screen.
- Everyone now has a real, public-only Firestore query path constrained by
  catalog ID, media type, review target type, and matched status, while
  preserving existing deterministic sort and cursor behavior. Selected
  exact-media queries use a server-only Firestore read; ordinary Everyone
  page reads retain their existing cache-aware behavior.
- Following reuses its server-authoritative active-follow path and constrains
  each eligible author/visibility query before its existing bounded ordering.
- Added a regression test proving protected exact-media results disappear when
  the authoritative active-follow relationship is no longer present, and that
  Following query failures do not substitute stale protected results.
- Added the required local Firestore composite-index definitions. The five
  exact-media indexes were subsequently deployed and enabled in the controlled
  Firestore-index checkpoint.

### Scope

- Exact-media retrieval is online-only in this checkpoint. Existing SQLite
  Community cache behavior and ordinary search typing remain unchanged; UI
  integration is deferred to Community Search Checkpoint 3B.

## **2026-10-11 — Community Search Catalog Suggestions**

### Added

- Added debounced, provider-neutral movie and TV catalog suggestions to the
  existing Community search field, including loading, empty, retry, stale
  response, selection, and dismissal handling.
- Selected catalog media retains its stable catalog ID, media type, and review
  target type across Following and Everyone, without using its display title
  as identity or changing either feed's review retrieval.

### Scope

- Selecting a title deliberately does not yet query Community reviews. Global
  Everyone review-text search and exact-media review retrieval remain deferred
  to later Community Search checkpoints.

## **2026-10-11 — Community Search Contracts and Query Design**

### Added

- Added provider-neutral, exact matched-media Community Search contracts and
  pure query-planning utilities without changing Community UI or executing new
  Firestore searches.
- Exact media selection now requires provider-qualified catalog
  identity plus explicit media/target type, so movie and TV catalog IDs cannot
  collide and manual review snapshots cannot appear as matched results.
- Extracted the existing bounded Following title/review-text keyword predicate
  into a reusable pure utility. Global Everyone keyword search remains
  intentionally deferred.

### Scope

- This checkpoint does not add a search screen, live catalog suggestions,
  Firestore indexes or rules, SQLite storage, or a global full-text backend.

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
