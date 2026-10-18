# CivicPort — NIPOST Digital Postcode integration

## What this integration does

- Preserves CivicPort's existing GPS capture, accuracy threshold, reverse-geocoded address and report workflow.
- Adds a postcode verification endpoint using the official NIPOST Digital Postcode API.
- Supports automatic postcode lookup from GPS through NIPOST's reverse-geocode endpoint.
- Lets a citizen enter a building-level postcode manually and verify it before submission.
- Stores postcode, verification status, verification timestamp, resolved label, and optional GPS-distance match.
- Displays verified postcode details in the public report detail and government report detail/table.
- Does not require a postcode for road segments, drains, or other infrastructure that may not have a building postcode. GPS remains required.

## API reference used

- Base URL: `https://api.postcode.gov.ng`
- Postcode lookup: `GET /v1/lookup?code=EK-01-A03-FK-01&level=1`
- Reverse geocode: `GET /v1/reverse-geocode?lat=...&lon=...&radius_m=25`
- Authentication header: `X-API-Key: YOUR_API_KEY`

Reference: https://docs.postcode.gov.ng/quickstart and https://docs.postcode.gov.ng/

The postcode API's official response fields and available lookup levels depend on the access granted to your API key. The adapter accepts the documented `data.postcode` and `data.valid` fields and normalizes common optional address/coordinate fields. The official quickstart shows the canonical format `EK-01-A03-FK-01`; the validator checks the five segments and ignores separators when validating.

## Security: rotate the secrets in the uploaded project

The uploaded archive contained `server/.env` with real-looking Cloudinary credentials, a Groq key, a database password and a weak JWT secret. Treat those values as exposed. Rotate/revoke them in their provider dashboards and update the deployment environment. Do not upload `.env` files to GitHub or share them in future archives.

The NIPOST key shown in the conversation was masked (`nipost_test_axxxxx...`) and is not a usable API credential. Set the full key you generated in the NIPOST developer dashboard directly in Render's server environment variables. Never place it in `client/.env`, `VITE_*`, React code, or a public repository.

## Files changed

- `server/src/services/nipostPostcode.js` — new NIPOST API adapter.
- `server/src/index.js` — postcode verification/lookup endpoints and server-side validation during report creation.
- `server/prisma/schema.prisma` — postcode metadata fields.
- `server/prisma/migrations/202610150001_add_nipost_digital_postcode/migration.sql` — safe additive migration.
- `server/.env.example` — NIPOST configuration examples.
- `client/src/services/api.js` — frontend API methods.
- `client/src/pages/PublicDashboard.jsx` — postcode entry, verification, optional GPS lookup, and public detail display.
- `client/src/pages/AdminDashboard.jsx` — postcode display in government report detail and report table.
- `client/src/styles.css` — postcode UI styling.

## Database and build steps

Run these from the project root or the relevant folder, after backing up the database.

### If the project uses Prisma db push

```bash
cd server
npx prisma generate
npx prisma db push
```

### If you manage schema changes with Prisma migrations

Review the included SQL migration, then apply it through your normal migration process. Because the original archive did not contain a Prisma migrations history, do not blindly run `prisma migrate deploy` unless your production database already has a correctly initialized migration history.

Then install/build/test as normal:

```bash
cd client
npm install
npm run build
```

```bash
cd server
npm install
npm start
```

## Render server environment variables

Set these in the CivicPort API service's Environment settings:

```env
NIPOST_API_BASE_URL=https://api.postcode.gov.ng
NIPOST_API_KEY=<your full real API key>
NIPOST_LOOKUP_LEVEL=1
NIPOST_TIMEOUT_MS=8000
NIPOST_REVERSE_GEOCODE_RADIUS_METERS=25
NIPOST_MAX_DISTANCE_METERS=250
```

Lookup level 1 is used by default for validation. The official docs say richer lookup levels can consume credits; do not raise the level unless you need those fields and have confirmed the key's access/credit policy.

## Endpoints added

- `GET /api/postcode/health` — indicates whether a key is configured.
- `GET /api/postcode/lookup-by-coordinates?lat=6.5&lon=3.4` — attempts official postcode reverse geocoding.
- `POST /api/postcode/verify` with JSON `{ "postcode": "EK-01-A03-FK-01", "latitude": 6.5, "longitude": 3.4 }` — validates a supplied code against NIPOST.

## Behavior and limitations

- A postcode is only saved as verified after the backend validates it with NIPOST.
- If the citizen enters a postcode but verification fails, report creation is rejected with a clear message. The citizen can retry or clear the optional postcode and submit with GPS/address only.
- If NIPOST is unavailable, automatic lookup does not block GPS capture. Manual verification and report submission with a supplied postcode require a successful NIPOST verification.
- The code attempts to compare NIPOST-returned coordinates with GPS if the lookup response includes them. If the API does not return coordinates, `postcodeLocationMatch` remains null; that means the postcode is valid but the API response did not support a distance comparison.
- The exact postcode shape is validated against the official example `EK-01-A03-FK-01` (11 alphanumeric characters separated into five segments). The current documentation's prose describes the code as 12 characters in one place, but its own canonical example contains 11 alphanumeric characters; if NIPOST changes this format, update the validator according to the latest official specification.
