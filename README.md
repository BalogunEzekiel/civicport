# CivicPort

A polished 3MTT NextGen Capstone civic issue reporting platform.

**Report → Locate → Track → Resolve**

## Stack

- React + Vite
- Node.js + Express
- SQLite
- Prisma
- Multer
- Leaflet + OpenStreetMap
- Vanilla CSS with a responsive, premium UI

## Features

### Public
- Civic dashboard with impact statistics
- Browse and search reports
- Interactive map
- Report an issue with photo and browser location
- Track a report by reference number
- Public status timeline
- Government public updates and progress photos

### Government
- Admin dashboard
- Review incoming reports
- Assign department
- Set priority
- Update status
- Add public updates
- Add internal notes
- Upload progress/completion photos
- View operational analytics

## Report lifecycle

`Submitted → Under Review → Assigned → In Progress → Resolved`

A report can also be `Rejected`.

## Requirements

- Node.js 18+
- npm 9+

## Run locally

Open the project folder in VS Code.

### 1. Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Initialize database

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. Start the application

```bash
npm run dev
```

Open http://localhost:5173

The API runs on http://localhost:5000.

## Demo government account

This MVP uses a simple demo-mode government portal.

- Government URL:
- Email: 
- Password: 

For a production deployment, replace demo authentication with proper identity/authentication.

## API

- `GET /api/health`
- `GET /api/stats`
- `GET /api/reports`
- `GET /api/reports/:reference`
- `POST /api/reports`
- `PATCH /api/reports/:reference/status`
- `PATCH /api/reports/:reference/assignment`
- `POST /api/reports/:reference/updates`

## Uploads

Images are stored in `server/uploads` for local development. A production version should use object storage such as S3-compatible storage or Cloudinary.

## Database

SQLite is selected for capstone simplicity. Prisma makes migration to PostgreSQL straightforward.

## Deployment

The frontend and backend can be deployed separately. For a simple production setup:

1. Deploy the Express API with a persistent database/storage.
2. Set the frontend `VITE_API_URL` to the API URL.
3. Build the React app with `npm run build`.
4. Serve the `client/dist` directory using your preferred static hosting provider.

## Demo flow

1. Open the public dashboard.
2. Submit a pothole report with an image and location.
3. Open `/admin`.
4. Change the report from Submitted to Under Review.
5. Assign Works & Infrastructure.
6. Change it to In Progress and add a public update.
7. Change it to Resolved and add a completion note.
8. Open the public report and show the complete timeline.

## Project structure

```text
civicport/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   └── package.json
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   └── index.js
│   ├── uploads/
│   └── package.json
├── .gitignore
├── package.json
└── README.md
```


## CivicPort AI Intelligence

CivicPort now includes an optional server-side AI decision-support layer.

### Capabilities

- **Automatic report triage:** newly submitted reports are analyzed in the background without blocking citizen submission.
- **Evidence-aware analysis:** the AI can analyze the report description and submitted Cloudinary evidence image.
- **Urgency and priority recommendations:** the AI provides an urgency score and suggested priority for government review.
- **Routing recommendations:** the AI suggests a relevant department and operational unit when supported by the evidence.
- **Related-report signals:** recent reports in the same category are supplied to the model so it can identify possible related cases.
- **Government Operations Copilot:** authenticated administrators can generate a report-specific operational brief.
- **Operations Intelligence:** the Analytics page can generate an AI summary of current civic workload, recurring patterns, resource signals and recommended actions.

### Human-in-the-loop design

AI recommendations are advisory. CivicPort does **not** allow the AI to autonomously reject reports, change workflow status, assign departments, or take enforcement action. Government administrators remain responsible for operational decisions.

### Configuration

Set these variables on the **server only**:

```env
GROQ_API_KEY="your-server-side-key"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
GROQ_MODEL_NAME="openai/gpt-oss-120b"
GROQ_VISION_MODEL="qwen/qwen3.8-27b"
```

The API key must never be placed in `client/.env`, `VITE_*` variables, browser code, or committed to Git.

### Database update

The AI layer adds two nullable fields to `Report`:

- `aiAnalysis`
- `aiAnalyzedAt`

After pulling this version locally, run:

```powershell
cd server
npx prisma generate
npx prisma db push
```

Then configure the same AI environment variables in the Render API service and redeploy.

If `GROQ_API_KEY` is not configured, CivicPort continues to operate normally as a non-AI civic reporting platform.
