# CivicPort AI Implementation

CivicPort includes a server-side AI intelligence layer powered by Groq.

## Architecture

Citizen report
→ Cloudinary evidence upload
→ PostgreSQL report creation
→ Background AI triage
→ Evidence image inspection (vision model)
→ GPT-OSS 120B structured reasoning
→ AI recommendations stored for human review

The AI layer never changes report status, rejects reports, assigns departments, or authorizes enforcement automatically.

## Groq configuration

Set these variables on the server only:

```env
GROQ_API_KEY="your_groq_api_key"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
GROQ_MODEL_NAME="openai/gpt-oss-120b"
GROQ_VISION_MODEL="qwen/qwen3.8-27b"
```

`openai/gpt-oss-120b` is used for structured reasoning and civic operations intelligence. The vision model is used only to inspect uploaded evidence images before the observations are passed to the reasoning model.

## Capabilities

- Automatic civic-report triage
- Evidence-image analysis
- Urgency and priority recommendations
- Department and unit recommendations
- Related-report / duplicate signals
- Government Operations Copilot
- Portfolio-level Operations Intelligence
- Human-in-the-loop review

## Production setup

1. Add the Groq variables to the Render API service.
2. Never add `GROQ_API_KEY` to the React/Vite client.
3. Add the nullable AI fields to the production `Report` table if they are not already present:

```sql
ALTER TABLE "Report"
ADD COLUMN IF NOT EXISTS "aiAnalysis" JSONB,
ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3);
```

4. Redeploy the API.
5. Log into the Government Portal and run AI analysis on an existing report.
6. Submit a new report and verify that background AI triage completes without affecting citizen submission.

## Human oversight

AI output is advisory. Government administrators remain responsible for reviewing evidence, validating recommendations, communicating with citizens, changing report status, routing work, and making operational decisions.
