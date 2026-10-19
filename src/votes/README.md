# Voting System

Backend endpoints for session voting. Setup, admin workflow for multi-day events and the visibility rules are described in the main [README](../../README.md#️-voting-system); this file covers data and endpoints.

## Data

All voting data lives in the content volume (`content/`, not in Git, seeded from `seed/` on first container start).

### `content/voting/votes.json`

Votes per day. Created on the first vote, seeded as `{}`. nginx blocks public access (`nginx.conf`, `nginx.prod.conf`), clients only get aggregates via `status.php`.

```json
{
  "samstag": {
    "sessions": { "10": 5, "20": 3 },
    "users": {
      "vote_abc123": { "sessionId": "10", "timestamp": 1735689600 }
    }
  }
}
```

Day keys are the day keys from `content/sessionplan/sessions.json`. One vote per user and day.

### `content/voting/voting-state.json`

Global voting status set in the admin tab "Voting": `inactive`, `active` or `ended`. A missing or unreadable file counts as inactive.

### `content/event.json` → `features.votingSchedule`

Optional voting window per session day, edited in the admin tab "Sessions":

```json
{ "day": "samstag", "dayLabel": "Samstag", "dayOfWeek": 6, "startTime": "16:00", "endTime": "17:45" }
```

`startTime`/`endTime` are optional (both or neither). Without a window, voting is open the whole day. `dayOfWeek` is optional if `day` is a German weekday name.

## Endpoints

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `vote.php` | public, POST | Records a vote |
| `status.php` | public, POST | Aggregated counts plus the caller's own vote, no other users' keys |
| `change-status.php` | admin session + CSRF | Sets `voting-state.json` |
| `transfer-votes.php` | admin session + CSRF | Copies counts from `votes.json` into `sessions.json` (medals in the session plan) |

### `vote.php`

```json
POST /votes/vote.php
{ "sessionId": "10", "day": "samstag", "userKey": "vote_abc123" }
```

Checks, in this order:

| Check | Response on failure |
| --- | --- |
| Parameters present, `userKey` matches `vote_[a-z0-9]{4,58}` | 400 |
| `day` is a day key in `sessions.json` | 400 `Invalid day` |
| Status is `active` | 403 `Voting is not active` |
| `event.json` readable | 503 `Voting configuration unavailable` |
| Today (in `event.timezone`, default `Europe/Berlin`) is this day, and the time is inside the window if one is set | 403 `Voting window closed for this day` |
| Session exists and is not cancelled | 400 `Unknown or cancelled session` |
| User has not voted for this day | 409 `User already voted for this day` |

Success returns `{ "success": true, "sessions": { ... }, "hasVoted": true }`. The window logic lives in `vote-helpers.php` (`isVotingWindowOpen()`); `src/sessionplan/sessionplan.js` applies the same rule to decide whether to show the form.

### `transfer-votes.php`

Allowed while the status is `active` or `ended`, so the results of a finished day can be transferred while the next day is still voting. Overwrites the `votes` field of matching sessions with the current counts; safe to repeat, deletes no votes.

## User identification

The client stores a key in `localStorage` (`pccampapp_vote_key`), falling back to a browser fingerprint hash. Reset in the browser console with `resetUserIdentity()`.

## Testing

- `?vote=<day>` on the session plan shows the voting form outside the window. Votes are still rejected server-side outside the window.
- To reset all votes, replace `content/voting/votes.json` with `{}`.
- Results: admin → tab "Voting" → "Ergebnisse anzeigen" (`/admin/results.php`, admin session required).
