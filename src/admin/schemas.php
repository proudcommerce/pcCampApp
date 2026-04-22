<?php
/**
 * Admin-API Payload-Validierung.
 *
 * Absichtlich als duenne Eigen-Implementierung (kein JSON-Schema-Loader), weil
 * der Scope klein und der Content ohnehin Admin-authentisiert ist. Ziel:
 *  - blockt gefaehrliche URL-Protokolle (javascript:, data:, vbscript:) in
 *    User-sichtbaren Links (Sponsors, Menu).
 *  - stellt sicher, dass Kernstrukturen plausibel sind (Arrays/Objekte wo
 *    erwartet, Pflichtfelder vorhanden).
 *  - verhindert absurd grosse Payloads (hart begrenzte Feldlaengen).
 *
 * validateResourcePayload($resource, $data) liefert null bei OK, sonst einen
 * kurzen Fehlertext fuer das Logging/die Response.
 */

const ADMIN_MAX_STRING_LEN = 10_000;
const ADMIN_MAX_URL_LEN    = 2_000;

function validateResourcePayload(string $resource, $data): ?string {
    try {
        switch ($resource) {
            case 'sessions':   return validateSessions($data);
            case 'timetable':  return validateTimetable($data);
            case 'news':       return validateNews($data);
            case 'food':       return validateFood($data);
            case 'allergene':  return validateAllergene($data);
            case 'sponsors':   return validateSponsors($data);
            case 'menu':       return validateMenu($data);
            case 'event':      return validateEvent($data);
            default:           return 'unknown resource';
        }
    } catch (Throwable $e) {
        return 'internal validator error: ' . $e->getMessage();
    }
}

/**
 * Erlaubt http/https/mailto/tel, leeren Wert, `#` und gut definierte relative
 * Pfade. Blockt javascript:, data:, vbscript:, file: etc.
 *
 * ACHTUNG — URLs mit Kontrollzeichen (inkl. \n, \r, \t, \0, 0x7F) werden hart
 * abgelehnt. Browser normalisieren solche Zeichen teilweise weg, wodurch z.B.
 * "java\nscript:alert(1)" wieder zu ausfuehrbarem JavaScript werden kann.
 */
function isSafeUrl(string $url): bool {
    // Kontrollzeichen (0x00-0x20 inkl. whitespace + 0x7F DEL) gar nicht erst
    // akzeptieren. Leading/trailing whitespace war frueher ueber trim()
    // erlaubt; Scheme-Smuggling macht das riskant.
    if (preg_match('/[\x00-\x20\x7f]/', $url)) return false;
    if ($url === '' || $url === '#') return true;
    if (strlen($url) > ADMIN_MAX_URL_LEN) return false;
    // Protokollrelative URLs ("//host/...") bewusst blocken: sie erben das
    // Seiten-Schema und entwerten die Scheme-Whitelist.
    if (str_starts_with($url, '//')) return false;
    // Relative/absolute Pfade: absolute ("/foo/bar"), dot-relativ
    // ("./assets/logo.png") oder reine Segmentpfade ("assets/logo.png").
    // Path-Traversal-Segmente (..) werden unten hart abgelehnt.
    if (preg_match('#^(/[\w.\-/]*|(\./)?[\w.\-]+(/[\w.\-]+)*/?)$#i', $url)) {
        foreach (explode('/', $url) as $seg) {
            if ($seg === '..') return false;
        }
        return true;
    }
    // Schema-basierte URL
    if (!preg_match('#^([a-z][a-z0-9+.-]*):#i', $url, $m)) return false;
    $scheme = strtolower($m[1]);
    return in_array($scheme, ['http', 'https', 'mailto', 'tel'], true);
}

function isBoundedString($v, int $max = ADMIN_MAX_STRING_LEN): bool {
    return is_string($v) && strlen($v) <= $max;
}

/* ─── sessions.json ───────────────────────────────────────────── */

function validateSessions($data): ?string {
    if (!is_array($data)) return 'sessions must be an object';
    foreach ($data as $day => $slots) {
        if (!is_string($day) || $day === '') return 'invalid day key';
        if (!is_array($slots)) return "day $day must map to timeslots";
        foreach ($slots as $slot => $sessions) {
            if (!is_string($slot)) return "invalid slot key in $day";
            if (!is_array($sessions)) return "slot $slot must be an array";
            foreach ($sessions as $idx => $s) {
                if (!is_array($s)) return "session $day/$slot/$idx not an object";
                foreach (['id', 'room', 'title', 'host'] as $f) {
                    if (isset($s[$f]) && !isBoundedString($s[$f])) {
                        return "session $day/$slot/$idx.$f invalid";
                    }
                }
                if (isset($s['cancelled']) && !is_bool($s['cancelled'])) {
                    return "session $day/$slot/$idx.cancelled must be bool";
                }
                if (isset($s['votes']) && !is_int($s['votes'])) {
                    return "session $day/$slot/$idx.votes must be int";
                }
            }
        }
    }
    return null;
}

/* ─── timetable.json ──────────────────────────────────────────── */

function validateTimetable($data): ?string {
    if (!is_array($data)) return 'timetable must be an object';
    foreach ($data as $day => $slots) {
        if (!is_string($day) || $day === '') return 'invalid day key';
        if (!is_array($slots)) return "day $day must map to timeslots";
        foreach ($slots as $slot => $items) {
            if (!is_string($slot)) return "invalid slot in $day";
            if (!is_array($items)) return "slot $slot must be an array";
            foreach ($items as $idx => $it) {
                if (!is_array($it)) return "timetable $day/$slot/$idx not an object";
                foreach (['room', 'title'] as $f) {
                    if (isset($it[$f]) && !isBoundedString($it[$f])) {
                        return "timetable $day/$slot/$idx.$f invalid";
                    }
                }
            }
        }
    }
    return null;
}

/* ─── news.json ───────────────────────────────────────────────── */

function validateNews($data): ?string {
    if (!is_array($data)) return 'news must be an object';
    $allowedPriorities = ['low', 'medium', 'high'];

    $checkItem = function ($item, string $ctx, bool $requireTime) use ($allowedPriorities): ?string {
        if (!is_array($item)) return "$ctx not an object";
        foreach (['id', 'content'] as $f) {
            if (isset($item[$f]) && !isBoundedString($item[$f])) return "$ctx.$f invalid";
        }
        if (isset($item['priority']) && !in_array($item['priority'], $allowedPriorities, true)) {
            return "$ctx.priority must be one of low|medium|high";
        }
        if ($requireTime) {
            foreach (['timeFrom', 'timeTo'] as $f) {
                if (isset($item[$f]) && !isBoundedString($item[$f], 10)) return "$ctx.$f invalid";
            }
        }
        return null;
    };

    if (isset($data['permanent'])) {
        if (!is_array($data['permanent'])) return 'permanent must be array';
        foreach ($data['permanent'] as $i => $it) {
            if ($err = $checkItem($it, "news.permanent[$i]", false)) return $err;
        }
    }
    if (isset($data['days'])) {
        if (!is_array($data['days'])) return 'days must be object';
        foreach ($data['days'] as $date => $items) {
            if (!is_string($date)) return 'invalid date key';
            if (!is_array($items)) return "days[$date] must be array";
            foreach ($items as $i => $it) {
                if ($err = $checkItem($it, "news.days[$date][$i]", true)) return $err;
            }
        }
    }
    return null;
}

/* ─── food/menue.json ─────────────────────────────────────────── */

function validateFood($data): ?string {
    if (!is_array($data)) return 'food must be an object';
    foreach ($data as $day => $meals) {
        if (!is_string($day)) return 'invalid day key';
        if (!is_array($meals)) return "food[$day] must be an object";
        foreach ($meals as $meal => $items) {
            if (!is_string($meal)) return "invalid meal key in $day";
            if (!is_array($items)) return "food[$day][$meal] must be array";
            foreach ($items as $i => $it) {
                if (!is_array($it)) return "food[$day][$meal][$i] not an object";
                if (isset($it['name']) && !isBoundedString($it['name'])) {
                    return "food[$day][$meal][$i].name invalid";
                }
                if (isset($it['allergens']) && !is_array($it['allergens'])) {
                    return "food[$day][$meal][$i].allergens must be array";
                }
            }
        }
    }
    return null;
}

/* ─── food/allergene.json ─────────────────────────────────────── */

function validateAllergene($data): ?string {
    if (!is_array($data)) return 'allergene must be an object';
    foreach ($data as $code => $desc) {
        if (!is_string($code) || !preg_match('/^[A-Za-z0-9]{1,8}$/', $code)) {
            return 'allergen code must be 1-8 alphanumerics';
        }
        if (!isBoundedString($desc, 1000)) return "allergen[$code] description invalid";
    }
    return null;
}

/* ─── sponsors.json ───────────────────────────────────────────── */

function validateSponsors($data): ?string {
    if (!is_array($data) || !isset($data['sponsors']) || !is_array($data['sponsors'])) {
        return 'sponsors.sponsors must be an array';
    }
    foreach ($data['sponsors'] as $i => $s) {
        if (!is_array($s)) return "sponsors[$i] not an object";
        foreach (['name', 'logo', 'beschreibung'] as $f) {
            if (isset($s[$f]) && !isBoundedString($s[$f])) return "sponsors[$i].$f invalid";
        }
        if (isset($s['url'])) {
            if (!isBoundedString($s['url'], ADMIN_MAX_URL_LEN) || !isSafeUrl($s['url'])) {
                return "sponsors[$i].url invalid or unsafe";
            }
        }
        if (isset($s['logo']) && !isSafeUrl($s['logo'])) {
            return "sponsors[$i].logo has unsafe scheme";
        }
    }
    return null;
}

/* ─── menu.json ───────────────────────────────────────────────── */

function validateMenu($data): ?string {
    if (!is_array($data) || !isset($data['items']) || !is_array($data['items'])) {
        return 'menu.items must be an array';
    }
    foreach ($data['items'] as $i => $it) {
        if (!is_array($it)) return "menu.items[$i] not an object";
        foreach (['title', 'description', 'icon'] as $f) {
            if (isset($it[$f]) && !isBoundedString($it[$f])) return "menu.items[$i].$f invalid";
        }
        if (isset($it['url'])) {
            if (!isBoundedString($it['url'], ADMIN_MAX_URL_LEN) || !isSafeUrl($it['url'])) {
                return "menu.items[$i].url invalid or unsafe";
            }
        }
        if (isset($it['active']) && !is_bool($it['active'])) {
            return "menu.items[$i].active must be bool";
        }
    }
    return null;
}

/* ─── event.json ──────────────────────────────────────────────── */

function validateEvent($data): ?string {
    if (!is_array($data)) return 'event must be an object';
    if (isset($data['event']) && !is_array($data['event'])) return 'event.event must be object';
    if (isset($data['branding']) && !is_array($data['branding'])) return 'event.branding must be object';
    if (isset($data['features']) && !is_array($data['features'])) return 'event.features must be object';

    // event.* Strings landen ungeparst in UI-Templates (iOS-Banner,
    // Dokumenten-Titeln, Meta-Tags). Striktes is_string + Laengenlimit —
    // vorher stand hier (string)$...; Arrays/Objekte hätten die Pruefung
    // damit als "Array" passiert.
    //
    // Zusaetzlich: Defense-in-Depth gegen XSS ueber diese Felder. Auch wenn
    // die PHP-Templates `eh_echo()` (htmlspecialchars) und der JS-Loader
    // `textContent` nutzen — ein versehentlicher Raw-Output in kuenftigen
    // Templates/Scripts wuerde sonst jederzeit zu Stored XSS. Darum hier
    // schon am Input HTML-Tags ablehnen. Falls formatierter Copyright
    // gewuenscht ist: strukturell im Template verankern (Link-Wrapper mit
    // textContent-Slot), nicht per HTML im JSON.
    foreach (['name', 'shortName', 'description', 'hashtag', 'copyright', 'locale'] as $f) {
        if (!isset($data['event'][$f])) continue;
        if (!isBoundedString($data['event'][$f], 500)) {
            return "event.$f must be a bounded string";
        }
        if ($data['event'][$f] !== strip_tags($data['event'][$f])) {
            return "event.$f must not contain HTML tags";
        }
    }

    if (isset($data['branding']['logo'])) {
        if (!isBoundedString($data['branding']['logo'], ADMIN_MAX_URL_LEN)
            || !isSafeUrl($data['branding']['logo'])
        ) {
            return 'branding.logo invalid or unsafe';
        }
    }

    if (isset($data['features']['votingSchedule'])) {
        if (!is_array($data['features']['votingSchedule'])) {
            return 'features.votingSchedule must be array';
        }
        foreach ($data['features']['votingSchedule'] as $i => $s) {
            if (!is_array($s)) return "votingSchedule[$i] not an object";
            // `day` dient als Key in JSON-Responses (status.php) und wandert in
            // sessionplan.js ins DOM (z.B. als `${day}-vote` id). Strikt einschraenken.
            if (isset($s['day']) && (!is_string($s['day']) || !preg_match('/^[a-z0-9_-]{1,32}$/', $s['day']))) {
                return "votingSchedule[$i].day must match ^[a-z0-9_-]{1,32}$";
            }
            if (isset($s['dayLabel']) && !isBoundedString($s['dayLabel'], 100)) {
                return "votingSchedule[$i].dayLabel invalid";
            }
            if (isset($s['dayOfWeek']) && (!is_int($s['dayOfWeek']) || $s['dayOfWeek'] < 0 || $s['dayOfWeek'] > 6)) {
                return "votingSchedule[$i].dayOfWeek must be 0..6";
            }
            foreach (['startTime', 'endTime'] as $tf) {
                if (isset($s[$tf]) && (!is_string($s[$tf]) || !preg_match('/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/', $s[$tf]))) {
                    return "votingSchedule[$i].$tf must be HH:MM";
                }
            }
        }
    }

    // Deprecated Key darf nicht mehr gesetzt werden — verhindert, dass beim
    // Speichern aus dem Raw-Editor versehentlich ein altes Secret persistiert
    // wird.
    if (isset($data['features']['votingAdminKey'])) {
        return 'features.votingAdminKey is deprecated — configure via VOTING_ADMIN_KEY env var and remove from event.json';
    }

    return null;
}
