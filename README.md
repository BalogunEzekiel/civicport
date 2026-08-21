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
