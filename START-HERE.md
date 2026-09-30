# START HERE — CivicPort

1. Install Node.js 18+.
2. Open this folder in VS Code.
3. Open the integrated terminal.
4. Run:

```bash
npm install
npm --prefix server install
npm --prefix client install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

5. Open http://localhost:5173
6. Government portal: http://localhost:5173/admin

If the browser blocks GPS on a non-secure local environment, the app allows a report to be submitted without coordinates.

For your capstone demo, use the seeded reports first, then submit one new report and move it through the government workflow.


## AI upgrade

The current build includes CivicPort AI Intelligence. See `README.md` for configuration and deployment steps.

The AI layer is deliberately human-in-the-loop: it recommends, summarizes and identifies signals, while government administrators retain control over report status, routing, rejection and resolution.
