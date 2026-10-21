# Schedule engine source

`identity.js`, `model.js`, and `hook.js` originate from X 发稿安排表 v1.2.0
(`E:/ClaudeCode/02-tools/x-schedule-board`, source commit
`96def721775ef94b6d40fc6595011810b65019fc`). The upstream license is retained
in `LICENSE`.

The identity/model files are preserved. The network hook additionally checks
the X/Twitter origin before observing a scheduled-tweet operation.
Credentials and captured list GET requests remain inside the MAIN-world hook.
Only successful X responses are recorded; missing list entries and elapsed
time do not imply that a post was published.

The host loads identity/hook in MAIN at document_start; the isolated world
loads identity/model before `modules/schedule-content.js`. The background
loads model before `modules/schedule-background.js`.

The adapter exposes `XTB.register('schedule', { snapshot, act })` with
`read` and `refresh`. Refresh defaults to interactive (can open X's scheduled
list in a new tab if no GET has yet been captured). Pass `{mode:'quiet'}` for
an optional replay that never opens a tab. State uses `scheduleEntries`,
`scheduleScans`, and `scheduleClocks` in extension local storage.

Suggested host verification:

- Feed CreateScheduledTweet using `data.tweet.rest_id` and
  `scheduling_info.execute_at`; assert automatic creation and text capture.
- Feed FetchScheduledTweets nested `tweet_create_request` records and the
  empty-list schema; assert the account-only snapshot and scan timestamp.
- Deliver an older list after a successful create/edit; assert `ignored`
  and preserve the successful mutation. Deliver two accounts concurrently;
  assert neither account replaces the other's records.
- Feed unknown nonempty schemas, failed HTTP responses, GraphQL errors,
  foreign-origin requests, and forged extension-frame network messages;
  assert no writes and no inferred publishing/deletion.
- Exercise interactive refresh without a captured GET (new list tab), quiet
  refresh (no new tab), and replay using a captured GET (only the original
  read operation). Verify request credentials never reach adapter storage.
- Switch the active profile during a pending local request; assert the old
  account response does not populate the new account's drawer.
