import "dotenv/config";

/* =========================================================
   GROQ CONFIGURATION
========================================================= */

const GROQ_BASE_URL = (
  process.env.GROQ_BASE_URL ||
  "https://api.groq.com/openai/v1"
).replace(/\/$/, "");

const DEFAULT_MODEL =
  process.env.GROQ_MODEL_NAME ||
  "openai/gpt-oss-120b";

const DEFAULT_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ||
  "qwen/qwen3.8-27b";

const CHAT_COMPLETIONS_URL =
  `${GROQ_BASE_URL}/chat/completions`;


/* =========================================================
   VISION RATE LIMIT PROTECTION
=========================================================

   Groq vision requests consume significant input tokens
   because the image itself is tokenized.

   We therefore:
   1. Prevent duplicate analysis of the same image.
   2. Enforce a cooldown between vision requests.
   3. Cache successful image observations.
   4. Do not blindly retry 429 rate-limit responses.
========================================================= */

let lastVisionRequestAt = 0;

const VISION_COOLDOWN_MS = 18000;
const VISION_CACHE_TTL_MS = 5 * 60 * 1000;

const visionCache = new Map();


/* =========================================================
   AI ANALYSIS SCHEMA
=========================================================

   IMPORTANT:
   confidencePercent is intentionally an INTEGER.

   The previous schema used:
       confidence: 0.00 - 1.00

   Groq occasionally produced invalid output such as:
       "confidence": 0. nine

   Using an integer percentage is substantially safer.

   The public/internal result is converted back to:
       confidence: 0.00 - 1.00
========================================================= */

const analysisSchema = {
  type: "object",

  additionalProperties: false,

  properties: {
    summary: {
      type: "string"
    },

    issueType: {
      type: "string"
    },

    urgencyScore: {
      type: "integer",
      minimum: 0,
      maximum: 100
    },

    impactLevel: {
      type: "string",
      enum: [
        "Low",
        "Moderate",
        "High",
        "Critical"
      ]
    },

    priorityRecommendation: {
      type: "string",
      enum: [
        "Low",
        "Medium",
        "High",
        "Critical"
      ]
    },

    recommendedDepartment: {
      type: "string"
    },

    recommendedUnit: {
      type: "string"
    },

    affectedGroups: {
      type: "array",
      items: {
        type: "string"
      }
    },

    safetyFlags: {
      type: "array",
      items: {
        type: "string"
      }
    },

    actionPlan: {
      type: "array",
      items: {
        type: "string"
      }
    },

    publicSummary: {
      type: "string"
    },

    duplicateCandidates: {
      type: "array",

      items: {
        type: "object",

        additionalProperties: false,

        properties: {
          reference: {
            type: "string"
          },

          reason: {
            type: "string"
          }
        },

        required: [
          "reference",
          "reason"
        ]
      }
    },

    confidencePercent: {
      type: "integer",
      minimum: 0,
      maximum: 100
    }
  },

  required: [
    "summary",
    "issueType",
    "urgencyScore",
    "impactLevel",
    "priorityRecommendation",
    "recommendedDepartment",
    "recommendedUnit",
    "affectedGroups",
    "safetyFlags",
    "actionPlan",
    "publicSummary",
    "duplicateCandidates",
    "confidencePercent"
  ]
};


/* =========================================================
   OPERATIONS INTELLIGENCE SCHEMA
========================================================= */

const operationsSchema = {
  type: "object",

  additionalProperties: false,

  properties: {
    situationSummary: {
      type: "string"
    },

    topPriorities: {
      type: "array",
      items: {
        type: "string"
      }
    },

    emergingPatterns: {
      type: "array",
      items: {
        type: "string"
      }
    },

    resourceSignals: {
      type: "array",
      items: {
        type: "string"
      }
    },

    recommendedActions: {
      type: "array",
      items: {
        type: "string"
      }
    },

    questionsForLeadership: {
      type: "array",
      items: {
        type: "string"
      }
    },

    confidencePercent: {
      type: "integer",
      minimum: 0,
      maximum: 100
    }
  },

  required: [
    "situationSummary",
    "topPriorities",
    "emergingPatterns",
    "resourceSignals",
    "recommendedActions",
    "questionsForLeadership",
    "confidencePercent"
  ]
};


/* =========================================================
   REPORT OPERATIONS BRIEF SCHEMA
========================================================= */

const briefSchema = {
  type: "object",

  additionalProperties: false,

  properties: {
    executiveSummary: {
      type: "string"
    },

    currentAssessment: {
      type: "string"
    },

    recommendedNextAction: {
      type: "string"
    },

    routingAdvice: {
      type: "string"
    },

    riskFactors: {
      type: "array",
      items: {
        type: "string"
      }
    },

    verificationQuestions: {
      type: "array",
      items: {
        type: "string"
      }
    },

    publicUpdateDraft: {
      type: "string"
    },

    escalationReason: {
      type: "string"
    },

    confidencePercent: {
      type: "integer",
      minimum: 0,
      maximum: 100
    }
  },

  required: [
    "executiveSummary",
    "currentAssessment",
    "recommendedNextAction",
    "routingAdvice",
    "riskFactors",
    "verificationQuestions",
    "publicUpdateDraft",
    "escalationReason",
    "confidencePercent"
  ]
};


/* =========================================================
   API KEY
========================================================= */

function getApiKey() {
  const apiKey =
    process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not configured."
    );
  }

  return apiKey;
}


/* =========================================================
   SAFE NUMBER HELPERS
========================================================= */

function clamp(value, min, max) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function normalizeConfidencePercent(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(
      clamp(value, 0, 100)
    );
  }

  if (typeof value === "string") {
    const parsed =
      Number(value.replace("%", "").trim());

    if (Number.isFinite(parsed)) {
      return Math.round(
        clamp(parsed, 0, 100)
      );
    }
  }

  return 0;
}

function confidenceFromPercent(value) {
  return Number(
    (
      normalizeConfidencePercent(value) / 100
    ).toFixed(2)
  );
}


/* =========================================================
   JSON PARSER
========================================================= */

function parseJsonText(text) {
  if (!text) {
    throw new Error(
      "The AI service returned an empty response."
    );
  }

  let value = String(text).trim();

  if (!value) {
    throw new Error(
      "The AI service returned an empty response."
    );
  }

  /*
   * Remove Markdown JSON fences if the model
   * unexpectedly returns them.
   */

  if (value.startsWith("```")) {
    value = value
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error(
      "Groq returned invalid JSON:"
    );

    console.error(value);

    throw new Error(
      "Groq returned invalid JSON."
    );
  }
}


/* =========================================================
   NORMALIZE REPORT ANALYSIS
========================================================= */

function normalizeAnalysisResult(result) {
  const confidencePercent =
    normalizeConfidencePercent(
      result?.confidencePercent ??
      result?.confidence
    );

  return {
    summary:
      typeof result?.summary === "string"
        ? result.summary
        : "No summary was generated.",

    issueType:
      typeof result?.issueType === "string"
        ? result.issueType
        : "Needs human review",

    urgencyScore:
      typeof result?.urgencyScore === "number"
        ? Math.round(
            clamp(
              result.urgencyScore,
              0,
              100
            )
          )
        : 0,

    impactLevel:
      typeof result?.impactLevel === "string"
        ? result.impactLevel
        : "Moderate",

    priorityRecommendation:
      typeof result?.priorityRecommendation === "string"
        ? result.priorityRecommendation
        : "Medium",

    recommendedDepartment:
      typeof result?.recommendedDepartment === "string"
        ? result.recommendedDepartment
        : "Needs human review",

    recommendedUnit:
      typeof result?.recommendedUnit === "string"
        ? result.recommendedUnit
        : "Needs human review",

    affectedGroups:
      Array.isArray(result?.affectedGroups)
        ? result.affectedGroups.map(String)
        : [],

    safetyFlags:
      Array.isArray(result?.safetyFlags)
        ? result.safetyFlags.map(String)
        : [],

    actionPlan:
      Array.isArray(result?.actionPlan)
        ? result.actionPlan.map(String)
        : [],

    publicSummary:
      typeof result?.publicSummary === "string"
        ? result.publicSummary
        : "The report has been received and is subject to human review.",

    duplicateCandidates:
      Array.isArray(result?.duplicateCandidates)
        ? result.duplicateCandidates
            .filter(
              (item) =>
                item &&
                typeof item === "object"
            )
            .map((item) => ({
              reference:
                typeof item.reference === "string"
                  ? item.reference
                  : "",

              reason:
                typeof item.reason === "string"
                  ? item.reason
                  : ""
            }))
        : [],

    /*
     * Preserve the frontend-compatible format:
     * confidence = 0.00 - 1.00
     */
    confidence:
      confidenceFromPercent(
        confidencePercent
      )
  };
}


/* =========================================================
   NORMALIZE OPERATIONS RESULT
========================================================= */

function normalizeOperationsResult(result) {
  const confidencePercent =
    normalizeConfidencePercent(
      result?.confidencePercent ??
      result?.confidence
    );

  return {
    situationSummary:
      typeof result?.situationSummary === "string"
        ? result.situationSummary
        : "No operations summary was generated.",

    topPriorities:
      Array.isArray(result?.topPriorities)
        ? result.topPriorities.map(String)
        : [],

    emergingPatterns:
      Array.isArray(result?.emergingPatterns)
        ? result.emergingPatterns.map(String)
        : [],

    resourceSignals:
      Array.isArray(result?.resourceSignals)
        ? result.resourceSignals.map(String)
        : [],

    recommendedActions:
      Array.isArray(result?.recommendedActions)
        ? result.recommendedActions.map(String)
        : [],

    questionsForLeadership:
      Array.isArray(result?.questionsForLeadership)
        ? result.questionsForLeadership.map(String)
        : [],

    confidence:
      confidenceFromPercent(
        confidencePercent
      )
  };
}


/* =========================================================
   NORMALIZE REPORT BRIEF
========================================================= */

function normalizeBriefResult(result) {
  const confidencePercent =
    normalizeConfidencePercent(
      result?.confidencePercent ??
      result?.confidence
    );

  return {
    executiveSummary:
      typeof result?.executiveSummary === "string"
        ? result.executiveSummary
        : "No executive summary was generated.",

    currentAssessment:
      typeof result?.currentAssessment === "string"
        ? result.currentAssessment
        : "Human review is required.",

    recommendedNextAction:
      typeof result?.recommendedNextAction === "string"
        ? result.recommendedNextAction
        : "Review the report and available evidence.",

    routingAdvice:
      typeof result?.routingAdvice === "string"
        ? result.routingAdvice
        : "Needs human review.",

    riskFactors:
      Array.isArray(result?.riskFactors)
        ? result.riskFactors.map(String)
        : [],

    verificationQuestions:
      Array.isArray(result?.verificationQuestions)
        ? result.verificationQuestions.map(String)
        : [],

    publicUpdateDraft:
      typeof result?.publicUpdateDraft === "string"
        ? result.publicUpdateDraft
        : "We have received this report and it is under review.",

    escalationReason:
      typeof result?.escalationReason === "string"
        ? result.escalationReason
        : "No specific escalation reason was established.",

    confidence:
      confidenceFromPercent(
        confidencePercent
      )
  };
}


/* =========================================================
   GROQ STRUCTURED OUTPUT
=========================================================

   Attempt order:

   1. Strict JSON Schema
   2. Strict JSON Schema with reinforced prompt
   3. JSON Schema without strict mode
   4. JSON Object Mode

   Fallbacks are only used for generation/schema failures.

   Authentication, rate-limit and server errors are NOT
   repeatedly retried.
========================================================= */

async function callGroqStructured({
  messages,
  schema,
  name,
  maxTokens = 1800,
  normalize
}) {
  const apiKey = getApiKey();

  async function makeRequest(body) {
    const response = await fetch(
      CHAT_COMPLETIONS_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },

        body: JSON.stringify(body)
      }
    );

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    return {
      response,
      payload
    };
  }

  async function extractResult(
    response,
    payload,
    attemptName
  ) {
    if (!response.ok) {
      return null;
    }

    const choice =
      payload?.choices?.[0];

    if (!choice) {
      throw new Error(
        `Groq ${attemptName} returned no completion choice.`
      );
    }

    const message =
      choice.message;

    if (!message) {
      throw new Error(
        `Groq ${attemptName} returned no message.`
      );
    }

    if (message.refusal) {
      throw new Error(
        `Groq refused the request: ${message.refusal}`
      );
    }

    const content =
      message.content;

    if (!content) {
      throw new Error(
        `Groq ${attemptName} returned no content.`
      );
    }

    const parsed =
      parseJsonText(content);

    return normalize
      ? normalize(parsed)
      : parsed;
  }


  /* =======================================================
     ATTEMPT 1
     Strict JSON Schema
  ======================================================= */

  const strictBody = {
    model: DEFAULT_MODEL,

    messages,

    max_completion_tokens:
      maxTokens,

    reasoning_effort:
      "low",

    reasoning_format:
      "hidden",

    response_format: {
      type: "json_schema",

      json_schema: {
        name,
        strict: true,
        schema
      }
    }
  };

  let result =
    await makeRequest(strictBody);

  if (result.response.ok) {
    return extractResult(
      result.response,
      result.payload,
      "structured request"
    );
  }


  /* =======================================================
     LOG FIRST FAILURE
  ======================================================= */

  console.error(
    `Groq structured request failed for ${name}:`,
    result.payload?.error?.message
  );

  if (
    result.payload?.error?.failed_generation
  ) {
    console.error(
      "Groq failed generation:",
      result.payload.error.failed_generation
    );
  }


  /* =======================================================
     ONLY FALL BACK FOR 400 GENERATION FAILURES
  ======================================================= */

  const isGenerationFailure =
    result.response.status === 400 &&
    Boolean(
      result.payload?.error?.failed_generation
    );

  if (!isGenerationFailure) {
    throw new Error(
      result.payload?.error?.message ||
      `Groq request failed with status ${result.response.status}.`
    );
  }


  /* =======================================================
     ATTEMPT 2
     Reinforced strict prompt
  ======================================================= */

  const reinforcedInstruction = `

IMPORTANT OUTPUT REQUIREMENTS:

Return ONLY valid JSON.

The confidencePercent field MUST be an INTEGER
between 0 and 100.

Examples:
70
85
92

Do NOT output:
0.85
85%
"85%"
"eighty five"
"0. eight"
"0. nine"

Never spell out numbers.

Every required field must be present.

Do not add fields that are not in the schema.

`;

  const reinforcedMessages =
    messages.map((message) => ({
      ...message,

      content:
        typeof message.content === "string"
          ? `${message.content}\n${reinforcedInstruction}`
          : message.content
    }));

  const reinforcedBody = {
    ...strictBody,

    messages:
      reinforcedMessages,

    reasoning_effort:
      "medium",

    max_completion_tokens:
      Math.max(
        maxTokens,
        1800
      )
  };

  result =
    await makeRequest(
      reinforcedBody
    );

  if (result.response.ok) {
    return extractResult(
      result.response,
      result.payload,
      "reinforced structured request"
    );
  }

  console.warn(
    `Reinforced structured request failed for ${name}. Trying best-effort JSON Schema.`
  );

  if (
    result.payload?.error?.failed_generation
  ) {
    console.error(
      "Groq reinforced failed generation:",
      result.payload.error.failed_generation
    );
  }


  /* =======================================================
     ATTEMPT 3
     JSON Schema without strict mode
  ======================================================= */

  const bestEffortBody = {
    model: DEFAULT_MODEL,

    messages:
      reinforcedMessages,

    max_completion_tokens:
      Math.max(
        maxTokens,
        1800
      ),

    reasoning_effort:
      "low",

    reasoning_format:
      "hidden",

    response_format: {
      type: "json_schema",

      json_schema: {
        name,
        strict: false,
        schema
      }
    }
  };

  result =
    await makeRequest(
      bestEffortBody
    );

  if (result.response.ok) {
    try {
      return extractResult(
        result.response,
        result.payload,
        "best-effort structured request"
      );
    } catch (error) {
      console.warn(
        `Best-effort JSON parsing failed for ${name}:`,
        error.message
      );
    }
  }


  /* =======================================================
     ATTEMPT 4
     JSON Object Mode
  ======================================================= */

  console.warn(
    `Trying JSON Object Mode fallback for ${name}.`
  );

  const objectBody = {
    model: DEFAULT_MODEL,

    messages:
      reinforcedMessages,

    max_completion_tokens:
      Math.max(
        maxTokens,
        1800
      ),

    reasoning_effort:
      "low",

    reasoning_format:
      "hidden",

    response_format: {
      type: "json_object"
    }
  };

  result =
    await makeRequest(
      objectBody
    );

  if (result.response.ok) {
    try {
      return extractResult(
        result.response,
        result.payload,
        "JSON Object Mode"
      );
    } catch (error) {
      console.error(
        `JSON Object Mode parsing failed for ${name}:`,
        error.message
      );
    }
  }

  console.error(
    `All structured-output attempts failed for ${name}.`
  );

  throw new Error(
    result.payload?.error?.message ||
    `Unable to generate valid structured AI output for ${name}.`
  );
}


/* =========================================================
   CLOUDINARY / IMAGE URL COMPATIBILITY
========================================================= */

function getVisionCompatibleUrl(photoUrl) {
  if (!photoUrl) {
    return photoUrl;
  }

  try {
    const url =
      new URL(photoUrl);

    /*
     * Cloudinary transformation:
     *
     * AVIF/WebP -> JPEG
     *
     * Example:
     *
     * /image/upload/abc.avif
     *
     * becomes:
     *
     * /image/upload/f_jpg/abc.jpg
     */

    if (
      url.hostname.includes(
        "res.cloudinary.com"
      ) &&
      url.pathname.includes(
        "/image/upload/"
      )
    ) {
      if (
        !url.pathname.includes(
          "/f_jpg/"
        )
      ) {
        url.pathname =
          url.pathname.replace(
            "/image/upload/",
            "/image/upload/f_jpg/"
          );
      }

      url.pathname =
        url.pathname.replace(
          /\.(avif|webp)$/i,
          ".jpg"
        );

      return url.toString();
    }

    return photoUrl;

  } catch {
    return photoUrl;
  }
}


/* =========================================================
   VISION CACHE HELPERS
========================================================= */

function getCachedVisionObservation(
  photoUrl
) {
  const cached =
    visionCache.get(photoUrl);

  if (!cached) {
    return null;
  }

  const age =
    Date.now() -
    cached.createdAt;

  if (
    age >
    VISION_CACHE_TTL_MS
  ) {
    visionCache.delete(
      photoUrl
    );

    return null;
  }

  return cached.observation;
}

function cacheVisionObservation(
  photoUrl,
  observation
) {
  visionCache.set(
    photoUrl,
    {
      createdAt:
        Date.now(),

      observation
    }
  );

  /*
   * Keep the in-memory cache small.
   */
  if (
    visionCache.size >
    100
  ) {
    const oldestKey =
      visionCache.keys().next().value;

    if (oldestKey) {
      visionCache.delete(
        oldestKey
      );
    }
  }
}


/* =========================================================
   WAIT FOR VISION COOLDOWN
========================================================= */

async function waitForVisionCooldown() {
  const now =
    Date.now();

  const elapsed =
    now -
    lastVisionRequestAt;

  if (
    elapsed <
    VISION_COOLDOWN_MS
  ) {
    const waitTime =
      VISION_COOLDOWN_MS -
      elapsed;

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          waitTime
        )
    );
  }

  lastVisionRequestAt =
    Date.now();
}


/* =========================================================
   EVIDENCE IMAGE ANALYSIS
=========================================================

   Vision analyzes only observable information.

   This is deliberately separated from GPT-OSS.
========================================================= */

async function analyzeEvidenceImage(
  photoUrl
) {
  if (!photoUrl) {
    return (
      "No evidence image was supplied."
    );
  }


  /* =======================================================
     CACHE CHECK
  ======================================================= */

  const cached =
    getCachedVisionObservation(
      photoUrl
    );

  if (cached) {
    console.log(
      "Using cached vision analysis for evidence image."
    );

    return cached;
  }


  /* =======================================================
     RATE LIMIT COOLDOWN
  ======================================================= */

  await waitForVisionCooldown();


  /* =======================================================
     PREPARE IMAGE URL
  ======================================================= */

  const visionUrl =
    getVisionCompatibleUrl(
      photoUrl
    );

  const apiKey =
    getApiKey();


  /* =======================================================
     VISION REQUEST
  ======================================================= */

  const response =
    await fetch(
      CHAT_COMPLETIONS_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`
        },

        body:
          JSON.stringify({
            model:
              DEFAULT_VISION_MODEL,

            messages: [
              {
                role:
                  "system",

                content:
                  `
You are CivicPort Evidence Vision.

Analyze only what is visibly observable
in the supplied civic-issue photograph.

Describe useful evidence for human government
reviewers, including where applicable:

- visible infrastructure damage
- road conditions
- water or drainage conditions
- streetlight or electrical infrastructure
- buildings or public facilities
- environmental conditions
- visible hazards
- signage
- approximate scene context

Do not:

- identify private individuals
- infer motives
- accuse people or organizations
- diagnose medical conditions
- invent facts
- claim certainty when the image is unclear

Clearly distinguish uncertainty.

Return concise plain text.

Maximum approximately 120 words.
                  `.trim()
              },

              {
                role:
                  "user",

                content: [
                  {
                    type:
                      "text",

                    text:
                      "Inspect this evidence image and describe observable civic-issue information that can support human review."
                  },

                  {
                    type:
                      "image_url",

                    image_url: {
                      url:
                        visionUrl
                    }
                  }
                ]
              }
            ],

            temperature:
              0.1,

            reasoning_effort:
              "none",

            max_completion_tokens:
              250,

            stream:
              false
          })
      }
    );


  let payload = {};

  try {
    payload =
      await response.json();
  } catch {
    payload = {};
  }


  /* =======================================================
     HANDLE RATE LIMIT
  ======================================================= */

  if (
    response.status === 429
  ) {
    const retryAfter =
      response.headers.get(
        "retry-after"
      );

    const detail =
      payload?.error?.message ||
      "Groq vision rate limit reached.";

    console.warn(
      `Vision rate limit reached. Retry-After: ${retryAfter || "unknown"}`
    );

    throw new Error(
      `${detail} Vision analysis was skipped for this request.`
    );
  }


  /* =======================================================
     HANDLE OTHER ERRORS
  ======================================================= */

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      `Groq vision request failed with status ${response.status}.`;

    throw new Error(
      detail
    );
  }


  /* =======================================================
     EXTRACT RESULT
  ======================================================= */

  const content =
    payload
      ?.choices?.[0]
      ?.message
      ?.content;

  if (!content) {
    return (
      "No useful visual observations were returned."
    );
  }

  const observation =
    String(content).trim();


  /* =======================================================
     CACHE RESULT
  ======================================================= */

  cacheVisionObservation(
    photoUrl,
    observation
  );

  return observation;
}


/* =========================================================
   REPORT INPUT
========================================================= */

function reportInput(
  report,
  candidates = [],
  evidenceObservation = ""
) {
  const candidateText =
    candidates.length
      ? candidates
          .map(
            (item) =>
              `${item.reference} | ${item.category} | ${item.status} | ${item.locationLabel || "Unknown location"} | ${item.title}`
          )
          .join("\n")
      : "No comparison reports available.";

  return [
    {
      role:
        "system",

      content:
        `
You are CivicPort Intelligence, an AI
decision-support layer for a civic issue
reporting platform.

Analyze the submitted civic report for
operational triage.

CONFIDENCE FORMAT:

The output schema contains confidencePercent.

confidencePercent MUST be an integer from 0 to 100.

Examples:
70
85
92

Never output:
0.85
85%
"85%"
"eighty five"
"0. nine"

Do not invent facts.

Separate observations from recommendations.

Never:

- make a final government decision
- reject a report
- accuse a person or organization
- authorize enforcement action
- change report status
- claim that an issue has been independently verified

Return structured JSON only.

Use practical public-sector language.

Recommend a department or unit only when
reasonably supported by the report.

If routing is uncertain, use:
"Needs human review".

Safety flags should identify concrete
operational concerns rather than speculation.

Evidence-image observations are supporting
evidence only. They may be incomplete or
uncertain and must never be treated as
independently verified facts.

If the report contains conflicting location
information, flag the inconsistency for human
verification instead of deciding which location
is correct.
        `.trim()
    },

    {
      role:
        "user",

      content:
        `
Report:

Reference:
${report.reference}

Title:
${report.title}

Citizen category:
${report.category}

Description:
${report.description}

Location:
${report.locationLabel || "Unknown"}

Latitude:
${report.latitude ?? "Unknown"}

Longitude:
${report.longitude ?? "Unknown"}

Current status:
${report.status}

Current priority:
${report.priority}

Current department:
${report.department || "Unassigned"}

Current assigned unit:
${report.assignedUnit || "Unassigned"}


Evidence-image observations:

${evidenceObservation || "No evidence image observations available."}


Potentially related recent reports:

${candidateText}
        `.trim()
    }
  ];
}


/* =========================================================
   REPORT AI ANALYSIS
=========================================================

   Used for:

   - AI Report Triage
   - Analyze with AI
   - Background report analysis
   - Duplicate/related report signals
========================================================= */

export async function analyzeReport(
  report,
  candidates = []
) {
  let evidenceObservation =
    "No evidence image was supplied.";


  /*
   * ==========================================================
   * EVIDENCE IMAGE ANALYSIS
   * ==========================================================
   */

  if (report.photoUrl) {
    try {
      evidenceObservation =
        await analyzeEvidenceImage(
          report.photoUrl
        );

    } catch (error) {
      console.warn(
        `Evidence image analysis failed for ${report.reference}:`,
        error.message
      );

      evidenceObservation =
        "Evidence image analysis was unavailable. Base the assessment on the report text and metadata only.";
    }
  }


  /*
   * ==========================================================
   * GENERATE STRUCTURED REPORT ANALYSIS
   * ==========================================================
   */

  const analysis =
    await callGroqStructured({
      messages:
        reportInput(
          report,
          candidates,
          evidenceObservation
        ),

      schema:
        analysisSchema,

      name:
        "civic_report_analysis",

      maxTokens:
        1800,

      normalize:
        normalizeAnalysisResult,
    });


  /*
   * ==========================================================
   * KEEP EVIDENCE OBSERVATION FOR THE COPILOT
   * ==========================================================
   *
   * This means the second Copilot request does not need
   * to send the same image to the vision model again.
   */

  return {
    ...analysis,

    _meta: {
      ...(analysis?._meta || {}),

      evidenceObservation,
    },
  };
}


/* =========================================================
   REPORT OPERATIONS BRIEF
=========================================================

   Used by the individual report AI Copilot.
========================================================= */

export async function generateReportBrief(
  report
) {
  const updates =
    (report.updates || [])
      .map(
        (update) =>
          `${
            update.createdAt?.toISOString?.() ||
            update.createdAt
          } | ${update.status} | ${update.message}`
      )
      .join("\n");


  /*
   * ==========================================================
   * REUSE EXISTING AI ANALYSIS
   * ==========================================================
   *
   * The initial "Analyze with AI" operation may already have
   * analyzed the evidence image.
   *
   * Do NOT automatically send the same image to the vision
   * model again when generating the Copilot brief.
   *
   * This reduces:
   *
   * - Groq vision token usage
   * - rate-limit pressure
   * - duplicate processing
   * - unnecessary latency
   */

  let evidenceObservation =
    "No evidence image observations are available.";


  /*
   * Existing stored AI analysis can contain metadata
   * from the previous analysis.
   */

  if (
    report.aiAnalysis?._meta
      ?.evidenceObservation
  ) {
    evidenceObservation =
      report.aiAnalysis
        ._meta
        .evidenceObservation;
  }


  /*
   * Some older records may have the observation
   * directly available.
   */

  if (
    !report.aiAnalysis &&
    report.photoUrl
  ) {
    /*
     * For old reports that have never been analyzed,
     * allow one vision analysis.
     */
    try {
      evidenceObservation =
        await analyzeEvidenceImage(
          report.photoUrl
        );
    } catch (error) {
      console.warn(
        `Evidence image analysis failed for brief ${report.reference}:`,
        error.message
      );

      evidenceObservation =
        "Evidence image analysis was unavailable.";
    }
  }


  return callGroqStructured({
    messages: [
      {
        role: "system",

        content:
          `
You are CivicPort Operations Copilot.

Produce a concise operational brief for
an authenticated government administrator.

Your role is decision support, not autonomous
government authority.

CONFIDENCE FORMAT:

The output schema contains confidencePercent.

confidencePercent MUST be an integer from
0 to 100.

Examples:

70
85
92

Never output:

0.85
85%
"85%"
"eighty five"
"0. nine"

Do not:

- change report status
- assign a department automatically
- reject a report
- authorize enforcement
- accuse a person or organization
- claim facts that are not present
- invent information

The public update draft must never claim that
government staff, departments, contractors,
crews, inspectors, or authorities have taken
action unless that action is explicitly present
in the supplied report timeline.

Do not say:

- "we are investigating"
- "our teams are responding"
- "crews have been dispatched"
- "the authority is aware"

unless the supplied record explicitly confirms it.

When action has not yet been confirmed, use
neutral language such as:

"We have received this report and it is under
review. The relevant team will assess the issue
and provide updates as information becomes
available."

If location information appears inconsistent,
flag it for human verification.

Do not treat a repeated location label alone
as proof of a geographic hotspot.

Do not automatically reject a report because
it appears unrelated to a government service.
Instead, recommend human review or appropriate
routing.

Return structured JSON only.
          `.trim(),
      },


      {
        role: "user",

        content:
          `
Report:

${JSON.stringify(
  {
    reference:
      report.reference,

    title:
      report.title,

    category:
      report.category,

    description:
      report.description,

    locationLabel:
      report.locationLabel,

    latitude:
      report.latitude,

    longitude:
      report.longitude,

    status:
      report.status,

    priority:
      report.priority,

    department:
      report.department,

    assignedUnit:
      report.assignedUnit,
  },
  null,
  2
)}


Evidence-image observations:

${evidenceObservation}


Timeline:

${updates || "No updates available."}


Prepare a practical operational brief
for human review.

The brief must contain:

1. Executive Summary
2. Current Assessment
3. Recommended Next Action
4. Routing Advice
5. Risk Factors
6. Verification Questions
7. Public Update Draft
8. Escalation Reason
9. Confidence

Focus on useful, evidence-based operational
information.

Do not make decisions on behalf of government
officials.
          `.trim(),
      },
    ],

    schema:
      briefSchema,

    name:
      "civic_operations_brief",

    maxTokens:
      1400,

    normalize:
      normalizeBriefResult,
  });
}


/* =========================================================
   OPERATIONS INTELLIGENCE
=========================================================

   Used by:

   Government Portal
   ->
   Analytics & Intelligence
   ->
   Run AI Operations Analysis
========================================================= */

export async function generateOperationsBrief(
  reports
) {
  const compact =
    reports.map(
      (report) => ({
        reference:
          report.reference,

        title:
          report.title,

        category:
          report.category,

        description:
          String(
            report.description || ""
          ).slice(
            0,
            800
          ),

        locationLabel:
          report.locationLabel ||
          "Unknown",

        latitude:
          report.latitude ??
          null,

        longitude:
          report.longitude ??
          null,

        status:
          report.status,

        priority:
          report.priority,

        department:
          report.department ||
          "Unassigned",

        assignedUnit:
          report.assignedUnit ||
          "Unassigned",

        createdAt:
          report.createdAt
      })
    );


  return callGroqStructured({
    messages: [
      {
        role:
          "system",

        content:
          `
You are CivicPort Operations Intelligence.

Analyze a civic-report portfolio for a
government operations team.

This is decision support only.

CONFIDENCE FORMAT:

The output schema contains confidencePercent.

confidencePercent MUST be an integer from 0 to 100.

Examples:
70
85
92

Never output:
0.85
85%
"85%"
"eighty five"
"0. nine"

Use ONLY the supplied records.

Do not:

- invent statistics
- invent causes
- invent staffing levels
- make political judgments
- accuse people or organizations
- claim a report is independently verified
- change report status
- assign reports
- authorize enforcement

Important:

A resource signal must be phrased as a
possible workload, routing, coverage, or
coordination signal unless the supplied
records directly establish the fact.

Do not treat the number of reports alone
as proof of severity.

Do not infer a geographic hotspot solely
because multiple reports contain the same
location label. Location labels may contain
data-quality errors.

If a title, description, coordinates, or
location label appear inconsistent, identify
the inconsistency and recommend verification.

Identify:

1. current operational pressure points
2. recurring issue patterns
3. possible emerging patterns
4. resource or workload signals
5. practical actions for human review
6. questions leadership should investigate

Keep every finding grounded in the supplied
records.

If evidence is insufficient, explicitly say
that verification is required.

Return ONLY the JSON object required by
the response schema.
        `.trim()
      },

      {
        role:
          "user",

        content:
          `
Analyze this CivicPort report portfolio.

REPORT COUNT:
${compact.length}

REPORTS:
${JSON.stringify(
  compact,
  null,
  2
)}

Generate the operations intelligence
summary now.
        `.trim()
      }
    ],

    schema:
      operationsSchema,

    name:
      "civic_operations_intelligence",

    maxTokens:
      1400,

    normalize:
      normalizeOperationsResult
  });
}


/* =========================================================
   AI CONFIGURATION STATUS
========================================================= */

export function isAIConfigured() {
  return Boolean(
    process.env.GROQ_API_KEY?.trim()
  );
}
