# Voting System

This directory contains the voting system for session ratings.

## Files

### `votes.json` (Not in Git)
**Active voting data file** - Contains all user votes and session vote counts.

- ⚠️ **This file is NOT committed to Git** (excluded via `.gitignore`)
- Contains sensitive user tracking data (userKey, timestamps)
- Automatically created by `vote.php` on first vote
- Preserved during deployment (excluded from rsync via `--exclude`)

**Structure:**
```json
{
  "samstag": {
    "sessions": {
      "10": 5,     // sessionId: voteCount
      "20": 3
    },
    "users": {
      "vote_abc123": {
        "sessionId": "10",
        "timestamp": 1735689600
      }
    }
  },
  "sonntag": { ... }
}
```

### `votes.json.example`
**Template file** - Shows the expected structure of `votes.json`.

- ✅ **This file IS committed to Git**
- Use this as a reference for the data structure
- Copy to `votes.json` to initialize an empty voting system

**To initialize voting system:**
```bash
cp src/votes/votes.json.example src/votes/votes.json
```

### `vote.php`
**Backend endpoint** - Handles vote submissions via POST requests.

**Features:**
- Validates day against `event.json` voting schedule
- Prevents duplicate votes per day (per userKey)
- Automatically creates `votes.json` if it doesn't exist
- Returns updated vote counts

**Request:**
```json
POST /votes/vote.php
{
  "sessionId": "10",
  "day": "samstag",
  "userKey": "vote_abc123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Vote recorded successfully",
  "votes": { ... }
}
```

**Response (Already Voted):**
```json
{
  "error": "User already voted for this day"
}
// HTTP 409 Conflict
```

### `results.php`
**Admin results page** - Displays voting results (requires authentication).

**Access:**
```
/votes/results.php?key=SECRET_KEY
```

**Features:**
- Protected by secret key (configured in PHP file)
- Shows top voted sessions per day
- Displays session titles, hosts, rooms, and vote counts
- Winner badge for top session

**Security:**
- Secret key required: `littGEEGsfdaxsd6Oe6DiJF`
- Returns 403 Forbidden without valid key

## Data Flow

```
User clicks vote button
  ↓
sessionplan.js sends POST to vote.php
  ↓
vote.php validates:
  - Required parameters (sessionId, day, userKey)
  - Valid voting day (from event.json)
  - User hasn't voted yet (checks votes.json)
  ↓
vote.php updates votes.json:
  - Increments session vote count
  - Stores user vote record
  ↓
Returns success + updated vote counts
  ↓
sessionplan.js updates sessions.json with votes
  ↓
Top 3 sessions shown with medals 🥇🥈🥉
```

## Voting Schedule

Voting times are configured in `event.json`:

```json
{
  "features": {
    "voting": true,
    "votingSchedule": [
      {
        "day": "samstag",
        "dayLabel": "Samstag",
        "dayOfWeek": 6,
        "startTime": "16:00",
        "endTime": "17:45"
      },
      {
        "day": "sonntag",
        "dayLabel": "Sonntag",
        "dayOfWeek": 0,
        "startTime": "14:00",
        "endTime": "15:30"
      }
    ]
  }
}
```

## User Identification

Users are identified by a **persistent browser fingerprint**:

1. **Primary:** `localStorage` key (`pccampapp_vote_key`)
2. **Fallback:** Browser fingerprint (userAgent, screen, timezone, canvas)
3. **Format:** `vote_abc123` (hash-based)

**Reset user identity (for testing):**
```javascript
// In browser console:
resetUserIdentity()
```

## Deployment

### Production Deployment
The `votes.json` file is **preserved** during deployment:

```bash
# .gitlab-ci.yml
rsync -avz --delete --exclude "votes/votes.json" build/ server:/path/
```

### Initial Setup on Server
1. SSH into production server
2. Copy example file:
   ```bash
   cd /var/www/html/votes
   cp votes.json.example votes.json
   chmod 666 votes.json  # PHP needs write access
   ```

## Security Considerations

### User Privacy
- UserKeys are anonymized hashes (not directly identifiable)
- No personal data (name, email, IP) is stored
- Timestamps are Unix timestamps (for internal use only)

### Vote Integrity
- One vote per day per user
- UserKey stored in localStorage (persists across sessions)
- Browser fingerprint as fallback (less reliable)

### Admin Access
- Results page requires secret key
- Key should be changed in production
- Consider IP whitelisting for results page

## Troubleshooting

### Votes not saving
1. Check PHP error logs
2. Verify `votes.json` is writable: `chmod 666 src/votes/votes.json`
3. Check `vote.php` returns 200 status

### Users can vote multiple times
1. Clear browser `localStorage` (testing only)
2. Check userKey generation in `sessionplan.js`
3. Verify `votes.json` structure matches example

### Voting not showing up
1. Check current day/time matches `votingSchedule`
2. Use URL override: `?vote=samstag`
3. Check browser console for errors

## Example Usage

### Initialize empty voting system:
```bash
cp src/votes/votes.json.example src/votes/votes.json
```

### Test voting in development:
```bash
# Start dev server
make dev-up

# Open browser to sessionplan page
# Wait for voting time window (or use ?vote=samstag)
# Vote for a session
# Check votes.json for updates
```

### View results:
```
http://localhost:5173/votes/results.php?key=littGEEGsfdaxsd6Oe6DiJF
```

### Reset votes for new event:
```bash
cp src/votes/votes.json.example src/votes/votes.json
# Or manually edit votes.json to reset counters
```
