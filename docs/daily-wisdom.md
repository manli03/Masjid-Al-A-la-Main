# Daily wisdom feed

The app downloads `https://oc-manli.duckdns.org/amalan/hikmah-harian.json`.
No local JSON file or build-time import is required, including in tests.

The server catalogue must have a positive integer `version` (content revision),
timezone `Asia/Kuala_Lumpur`, `resetOn: "01-01"`, source metadata, and at least two
nonempty quotes with unique IDs and text. Quote count can change; version 1 with
129 entries is accepted, as are later revisions and the original 130 entries.
The optional category and sourceNumber fields preserve the five
source sections. The homepage title is "Mutiara Hari Ini" with no attribution line.

## Loading and cache updates

On every homepage entry (`ionViewWillEnter`), including returning to the Ionic
cached Home tab, the app checks the server. Pull-to-refresh also checks it.
A timestamp query parameter bypasses browser/CDN cached responses without adding
custom headers or a CORS preflight. No server changes to the JSON format are needed.
Concurrent checks share one request, with a five-second timeout.

On startup, the app validates and displays the last downloaded catalogue from
Capacitor Preferences (`daily_wisdom_catalogue`). The server response is also
validated. If its contents differ, the displayed quote updates and the new
catalogue replaces the saved one. Identical responses do not rewrite storage.
Invalid responses, connection errors and timeouts retain the last valid download
and log a warning in the developer console explaining the failure.
With no valid cache, the card stays hidden until a server check succeeds. The next
homepage entry or pull-to-refresh tries again.

## Shared annual rotation

Selection uses the Malaysia calendar date: `(day of year - 1) % quote count`.
Every 1 January starts at quote #1, even if the prior cycle was unfinished.
After the last quote, the list repeats. Leap day advances the rotation by one day.
First-time and returning visitors see the quote for the current date, irrespective
of installation date or missed days. With 130 quotes, 20 October 2026 shows quote #33.
The quote also advances automatically while the homepage stays open.

Devices need accurate clocks. Keep quote order and count stable to keep the shared
schedule stable. Editing today's selected quote changes today's display; editing
another quote changes that quote's scheduled date. Adding/removing quotes can
change which quote is selected today. Offline clients use their last download; if server content has
changed, they catch up after a successful check.

## Hosting

Serve `application/json; charset=utf-8`, allowing the web app and Capacitor origins
through CORS. For a public feed with no credentials, `Access-Control-Allow-Origin: *`
is sufficient. An allowlist must include every deployed origin, such as
`http://localhost:8100`, `https://localhost` and `https://masjidala.web.app`.
CORS permission must be configured on the JSON host.
