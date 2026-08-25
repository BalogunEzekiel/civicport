import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

/* =========================================================
   CLOUDINARY CONFIGURATION
========================================================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================================================
   EXPRESS CONFIGURATION
========================================================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://civicportng.onrender.com",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // such as server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS origin not allowed.")
      );
    },

    credentials: true,
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(cookieParser());

/* =========================================================
   GOVERNMENT AUTHENTICATION
========================================================= */

const JWT_SECRET = process.env.JWT_SECRET;

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || "8h";

if (!JWT_SECRET) {
  console.error(
    "JWT_SECRET is not configured."
  );
}

function createGovernmentToken({
  email,
  role,
}) {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT authentication is not configured."
    );
  }

  return jwt.sign(
    {
      sub: email,
      email,
      role,
      type: "government",
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

function getAuthToken(req) {
  return req.cookies?.civicport_auth || null;
}

function requireGovernmentAuth(
  req,
  res,
  next
) {
  try {
    const token = getAuthToken(req);

    if (!token) {
      return res.status(401).json({
        error:
          "Government authentication is required.",
      });
    }

    if (!JWT_SECRET) {
      console.error(
        "JWT_SECRET is not configured."
      );

      return res.status(500).json({
        error:
          "Government authentication is not configured.",
      });
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    if (
      decoded?.type !== "government"
    ) {
      return res.status(403).json({
        error:
          "Invalid government authentication.",
      });
    }

    req.governmentUser = {
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.warn(
      "Government authentication failed:",
      error.message
    );

    return res.status(401).json({
      error:
        "Government authentication has expired or is invalid.",
    });
  }
}


/* =========================================================
   GOVERNMENT LOGIN
========================================================= */

app.post(
  "/api/auth/government-login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        typeof email !== "string" ||
        !email.trim()
      ) {
        return res.status(400).json({
          error:
            "Email is required.",
        });
      }

      if (
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          error:
            "Password is required.",
        });
      }

      const validEmail =
        process.env.GOVERNMENT_EMAIL;

      const passwordHash =
        process.env.GOVERNMENT_PASSWORD_HASH;

      const role =
        process.env.GOVERNMENT_ROLE ||
        "Government Administrator";

      if (
        !validEmail ||
        !passwordHash ||
        !JWT_SECRET
      ) {
        console.error(
          "Government authentication environment variables are not configured."
        );

        return res.status(500).json({
          error:
            "Government authentication is not configured.",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      const normalizedValidEmail =
        validEmail.trim().toLowerCase();

      if (
        normalizedEmail !==
        normalizedValidEmail
      ) {
        return res.status(401).json({
          error:
            "Invalid government credentials.",
        });
      }

      const passwordValid =
        await bcrypt.compare(
          password,
          passwordHash
        );

      if (!passwordValid) {
        return res.status(401).json({
          error:
            "Invalid government credentials.",
        });
      }

      const token =
        createGovernmentToken({
          email: validEmail,
          role,
        });

      res.cookie(
        "civicport_auth",
        token,
        {
          httpOnly: true,
          secure:
            process.env.NODE_ENV ===
            "production",
          sameSite:
            process.env.NODE_ENV ===
            "production"
              ? "none"
              : "lax",
          maxAge: 8 * 60 * 60 * 1000,
          path: "/",
        }
      );

      return res.json({
        success: true,

        user: {
          email: validEmail,
          role,
        },
      });
    } catch (error) {
      console.error(
        "Government login failed:",
        error
      );

      return res.status(500).json({
        error:
          "Government authentication failed.",
      });
    }
  }
);

/* =========================================================
   GOVERNMENT LOGOUT
========================================================= */

app.post(
  "/api/auth/government-logout",
  (_req, res) => {
    res.clearCookie(
      "civicport_auth",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite:
          process.env.NODE_ENV ===
          "production"
            ? "none"
            : "lax",
        path: "/",
      }
    );

    res.json({
      success: true,
      message:
        "Government session ended.",
    });
  }
);

/* =========================================================
   CURRENT GOVERNMENT USER
========================================================= */

app.get(
  "/api/auth/me",
  requireGovernmentAuth,
  (req, res) => {
    res.json({
      authenticated: true,
      user: req.governmentUser,
    });
  }
);

/* =========================================================
   ROOT
========================================================= */

app.get("/", (_, res) => {
  res.status(200).json({
    status: "ok",
    service: "CivicPort API",
    message: "CivicPort API is running.",
  });
});

/* =========================================================
   MULTER
   Images are stored temporarily in memory and then
   uploaded directly to Cloudinary.
========================================================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },

  fileFilter: (_, file, cb) => {
    if (file.mimetype?.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only image files are allowed."
        )
      );
    }
  },
});

/* =========================================================
   CLOUDINARY UPLOAD HELPER
========================================================= */

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.buffer) {
      reject(
        new Error(
          "A valid image file is required."
        )
      );
      return;
    }

    const stream =
      cloudinary.uploader.upload_stream(
        {
          folder: "civicport",
          resource_type: "image",
        },

        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

    stream.end(file.buffer);
  });
}

/* =========================================================
   VALID VALUES
========================================================= */

const validStatuses = [
  "Submitted",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
  "Rejected",
];

const validPriorities = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

/* =========================================================
   CIVICPORT WORKFLOW
========================================================= */

/*
   Normal lifecycle:

   Submitted
       ↓
   Under Review
       ↓
   Assigned
       ↓
   In Progress
       ↓
   Resolved

   Rejected may be reached from any ACTIVE stage.

   Resolved and Rejected are terminal states.
*/

const STATUS_TRANSITIONS = {
  Submitted: [
    "Under Review",
    "Rejected",
  ],

  "Under Review": [
    "Assigned",
    "Rejected",
  ],

  Assigned: [
    "In Progress",
    "Rejected",
  ],

  "In Progress": [
    "Resolved",
  ],

  Resolved: [],

  Rejected: [],
};

const TERMINAL_STATUSES = [
  "Resolved",
  "Rejected",
];

function canTransitionStatus(
  currentStatus,
  nextStatus
) {
  if (!currentStatus || !nextStatus) {
    return false;
  }

  if (currentStatus === nextStatus) {
    return true;
  }

  return (
    STATUS_TRANSITIONS[currentStatus] || []
  ).includes(nextStatus);
}

function getStatusTransitionError(
  currentStatus,
  nextStatus
) {
  if (!validStatuses.includes(nextStatus)) {
    return "Invalid status.";
  }

  if (
    currentStatus === "Rejected"
  ) {
    return (
      "Rejected reports are closed and cannot be returned to the workflow."
    );
  }

  if (
    currentStatus === "Resolved"
  ) {
    return (
      "Resolved reports have completed their operational lifecycle."
    );
  }

  if (
    !canTransitionStatus(
      currentStatus,
      nextStatus
    )
  ) {
    const allowed =
      STATUS_TRANSITIONS[
        currentStatus
      ] || [];

    if (allowed.length === 0) {
      return `No further status transition is permitted from ${currentStatus}.`;
    }

    return (
      `Invalid workflow transition: ${currentStatus} → ${nextStatus}. ` +
      `The next permitted status is ${allowed.join(
        " or "
      )}.`
    );
  }

  return null;
}

function hasCompleteRouting({
  department,
  assignedUnit,
}) {
  return Boolean(
    department &&
      department.trim() &&
      assignedUnit &&
      assignedUnit.trim()
  );
}

/* =========================================================
   RESPONSE NORMALIZATION
========================================================= */

/*
  Cloudinary URLs are already complete URLs.

  Example:

  https://res.cloudinary.com/qh7nwgxh/image/upload/...

  Do NOT prepend the Render API URL.
*/

function normalizeReport(report) {
  if (!report) {
    return report;
  }

  return {
    ...report,

    photoUrl:
      report.photoUrl || null,

    updates:
      report.updates?.map((update) => ({
        ...update,

        photoUrl:
          update.photoUrl || null,
      })) || [],
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (_, res) => {
  res.status(200).json({
    status: "ok",
    service: "civicport-api",
  });
});

app.get("/api/health", (_, res) => {
  res.status(200).json({
    ok: true,
    service: "CivicPort API",
  });
});

/* =========================================================
   STATISTICS
========================================================= */

app.get("/api/stats", async (_, res) => {
  try {
    const activeStatuses = [
      "Submitted",
      "Under Review",
      "Assigned",
      "In Progress",
    ];

    const [
      total,
      resolved,
      progress,
      open,
      rejected,
      assigned,
      unassigned,
      categories,
    ] = await Promise.all([
      /* -----------------------------------------
         TOTAL
      ----------------------------------------- */

      prisma.report.count(),

      /* -----------------------------------------
         RESOLVED
      ----------------------------------------- */

      prisma.report.count({
        where: {
          status: "Resolved",
        },
      }),

      /* -----------------------------------------
         IN PROGRESS
      ----------------------------------------- */

      prisma.report.count({
        where: {
          status: "In Progress",
        },
      }),

      /* -----------------------------------------
         OPEN

         Submitted
         Under Review
         Assigned
      ----------------------------------------- */

      prisma.report.count({
        where: {
          status: {
            in: [
              "Submitted",
              "Under Review",
              "Assigned",
            ],
          },
        },
      }),

      /* -----------------------------------------
         REJECTED
      ----------------------------------------- */

      prisma.report.count({
        where: {
          status: "Rejected",
        },
      }),

      /* -----------------------------------------
         ASSIGNED

         IMPORTANT:
         A report is considered assigned only when:

         1. It is NOT rejected
         2. It has a department
         3. It has an assigned unit
      ----------------------------------------- */

      prisma.report.count({
        where: {
          status: {
            in: activeStatuses,
          },

          AND: [
            {
              department: {
                not: null,
              },
            },

            {
              department: {
                not: "",
              },
            },

            {
              assignedUnit: {
                not: null,
              },
            },

            {
              assignedUnit: {
                not: "",
              },
            },
          ],
        },
      }),

      /* -----------------------------------------
         UNASSIGNED

         IMPORTANT:

         Rejected reports are automatically excluded
         because only ACTIVE statuses are considered.

         Therefore:

         Unassigned =
         active report
         + missing department OR missing unit
      ----------------------------------------- */

      prisma.report.count({
        where: {
          status: {
            in: activeStatuses,
          },

          OR: [
            {
              department: null,
            },

            {
              department: "",
            },

            {
              assignedUnit: null,
            },

            {
              assignedUnit: "",
            },
          ],
        },
      }),

      /* -----------------------------------------
         CATEGORIES
      ----------------------------------------- */

      prisma.report.groupBy({
        by: ["category"],

        _count: {
          category: true,
        },

        orderBy: {
          _count: {
            category: "desc",
          },
        },
      }),
    ]);

    res.json({
      total,
      resolved,
      progress,
      open,
      rejected,
      assigned,
      unassigned,
      categories,
    });
  } catch (error) {
    console.error(
      "Failed to load statistics:",
      error
    );

    res.status(500).json({
      error:
        "Failed to load dashboard statistics.",
    });
  }
});

/* =========================================================
   REVERSE GEOCODING
========================================================= */

app.get(
  "/api/geocode/reverse",
  async (req, res) => {
    try {
      const lat = Number(
        req.query.lat
      );

      const lon = Number(
        req.query.lon
      );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        return res.status(400).json({
          error:
            "Valid latitude and longitude are required.",
        });
      }

      if (
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        return res.status(400).json({
          error:
            "Latitude or longitude is outside the valid geographic range.",
        });
      }

      const url = new URL(
        "https://nominatim.openstreetmap.org/reverse"
      );

      url.searchParams.set(
        "format",
        "jsonv2"
      );

      url.searchParams.set(
        "lat",
        String(lat)
      );

      url.searchParams.set(
        "lon",
        String(lon)
      );

      url.searchParams.set(
        "zoom",
        "18"
      );

      url.searchParams.set(
        "addressdetails",
        "1"
      );

      url.searchParams.set(
        "accept-language",
        "en"
      );

      const response =
        await fetch(
          url.toString(),
          {
            headers: {
              "User-Agent":
                "CivicPort/1.0 (+https://civicportng.onrender.com)",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Geocoding service returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const address =
        data?.address || {};

      const road =
        address.road ||
        address.pedestrian ||
        address.highway ||
        address.residential ||
        "";

      const area =
        address.neighbourhood ||
        address.suburb ||
        address.quarter ||
        address.city_district ||
        "";

      const city =
        address.city ||
        address.town ||
        address.municipality ||
        address.village ||
        "";

      const state =
        address.state ||
        "";

      const parts = [
        road,
        area,
        city,
        state,
      ].filter(Boolean);

      const uniqueParts = [
        ...new Map(
          parts.map((part) => [
            part.toLowerCase(),
            part,
          ])
        ).values(),
      ];

      const locationLabel =
        uniqueParts.length > 0
          ? uniqueParts.join(", ")
          : data.display_name ||
            `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

      res.json({
        locationLabel,

        displayName:
          data.display_name ||
          locationLabel,

        address,

        latitude: lat,

        longitude: lon,
      });
    } catch (error) {
      console.error(
        "Reverse geocoding failed:",
        error
      );

      res.status(500).json({
        error:
          "Unable to identify this location.",
      });
    }
  }
);

/* =========================================================
   GET ALL REPORTS
========================================================= */

app.get(
  "/api/reports",
  async (req, res) => {
    try {
      const {
        status,
        category,
        q,
      } = req.query;

      const search =
        typeof q === "string"
          ? q.trim()
          : "";

      const reports =
        await prisma.report.findMany({
          where: {
            ...(status &&
            status !== "All"
              ? {
                  status,
                }
              : {}),

            ...(category &&
            category !== "All"
              ? {
                  category,
                }
              : {}),

            ...(search
              ? {
                  OR: [
                    {
                      title: {
                        contains:
                          search,
                      },
                    },

                    {
                      description: {
                        contains:
                          search,
                      },
                    },

                    {
                      locationLabel: {
                        contains:
                          search,
                      },
                    },

                    {
                      reference: {
                        contains:
                          search,
                      },
                    },
                  ],
                }
              : {}),
          },

          orderBy: {
            createdAt: "desc",
          },

          include: {
            updates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      res.json(
        reports.map(
          normalizeReport
        )
      );
    } catch (error) {
      console.error(
        "Failed to load reports:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load reports.",
      });
    }
  }
);

/* =========================================================
   GET SINGLE REPORT
========================================================= */

app.get(
  "/api/reports/:reference",
  async (req, res) => {
    try {
      const report =
        await prisma.report.findUnique({
          where: {
            reference:
              req.params.reference,
          },

          include: {
            updates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      if (!report) {
        return res.status(404).json({
          error:
            "Report not found.",
        });
      }

      res.json(
        normalizeReport(report)
      );
    } catch (error) {
      console.error(
        "Failed to load report:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load report.",
      });
    }
  }
);

/* =========================================================
   CREATE NEW REPORT
   REQUIRED:
   - Title
   - Category
   - Description
   - Photo
   - Latitude
   - Longitude
   - Location label

   Flow:

   Browser
      ↓
   Multer memory
      ↓
   Cloudinary
      ↓
   PostgreSQL
========================================================= */

app.post(
  "/api/reports",
  upload.single("photo"),
  async (req, res) => {
    try {
      const {
        title,
        category,
        description,
        latitude,
        longitude,
        locationLabel,
      } = req.body;

      /* -----------------------------------------
         REQUIRED TEXT FIELDS
      ----------------------------------------- */

      if (
        !title ||
        !title.trim()
      ) {
        return res.status(400).json({
          error:
            "Issue title is required.",
        });
      }

      if (
        !category ||
        !category.trim()
      ) {
        return res.status(400).json({
          error:
            "Issue category is required.",
        });
      }

      if (
        !description ||
        !description.trim()
      ) {
        return res.status(400).json({
          error:
            "Issue description is required.",
        });
      }

      /* -----------------------------------------
         PHOTO IS MANDATORY
      ----------------------------------------- */

      if (!req.file) {
        return res.status(400).json({
          error:
            "A photo is required as evidence for every civic report.",
        });
      }

      /* -----------------------------------------
         VALIDATE GPS LOCATION
      ----------------------------------------- */

      const parsedLatitude =
        Number(latitude);

      const parsedLongitude =
        Number(longitude);

      if (
        !Number.isFinite(
          parsedLatitude
        ) ||
        !Number.isFinite(
          parsedLongitude
        )
      ) {
        return res.status(400).json({
          error:
            "A valid GPS location is required before submitting a report.",
        });
      }

      if (
        parsedLatitude < -90 ||
        parsedLatitude > 90 ||
        parsedLongitude < -180 ||
        parsedLongitude > 180
      ) {
        return res.status(400).json({
          error:
            "The supplied GPS coordinates are invalid.",
        });
      }

      /* -----------------------------------------
         LOCATION LABEL IS REQUIRED
      ----------------------------------------- */

      if (
        !locationLabel ||
        !locationLabel.trim()
      ) {
        return res.status(400).json({
          error:
            "A report location is required before submitting.",
        });
      }

      /* -----------------------------------------
         GENERATE REFERENCE
      ----------------------------------------- */

      const count =
        await prisma.report.count();

      const reference =
        `CW-${String(
          125 + count
        ).padStart(6, "0")}`;

      /* -----------------------------------------
         UPLOAD REQUIRED PHOTO TO CLOUDINARY
      ----------------------------------------- */

      const uploaded =
        await uploadToCloudinary(
          req.file
        );

      if (
        !uploaded ||
        !uploaded.secure_url
      ) {
        throw new Error(
          "Cloudinary did not return a valid image URL."
        );
      }

      const photoUrl =
        uploaded.secure_url;

      console.log(
        `Cloudinary upload successful: ${photoUrl}`
      );

      /* -----------------------------------------
         CREATE REPORT
      ----------------------------------------- */

      const report =
        await prisma.report.create({
          data: {
            reference,

            title:
              title.trim(),

            category:
              category.trim(),

            description:
              description.trim(),

            latitude:
              parsedLatitude,

            longitude:
              parsedLongitude,

            locationLabel:
              locationLabel.trim(),

            photoUrl,

            status:
              "Submitted",

            priority:
              "Medium",

            updates: {
              create: {
                status:
                  "Submitted",

                message:
                  "Report received from a citizen.",

                isPublic:
                  true,

                photoUrl,
              },
            },
          },

          include: {
            updates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      console.log(
        `Civic report created: ${reference}`
      );

      res.status(201).json(
        normalizeReport(report)
      );
    } catch (error) {
      console.error(
        "Failed to create report:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Failed to create civic report.",
      });
    }
  }
);

/* ============================================================
   REJECT REPORT
   ------------------------------------------------------------
   Destructive action requiring:

   1. Frontend confirmation
   2. Administrator password
   3. Backend password verification
   4. Server-side workflow validation

   Password is NEVER stored in the database or frontend.
============================================================ */

app.post(
  "/api/reports/:reference/reject",
  requireGovernmentAuth,
  async (req, res) => {
    try {
      const {
        password,
        message,
        isPublic = true,
      } = req.body;

      /* --------------------------------------------------------
         VALIDATE ADMINISTRATOR PASSWORD INPUT
      -------------------------------------------------------- */

      if (
        typeof password !== "string" ||
        !password
      ) {
        return res.status(401).json({
          error:
            "Administrator password is required.",
        });
      }

      /* --------------------------------------------------------
         VERIFY GOVERNMENT PASSWORD
         --------------------------------------------------------

            Password hash remains server-side in:

              GOVERNMENT_PASSWORD_HASH

            The plaintext password is never stored
            or returned to the client.
                   
      -------------------------------------------------------- */

      const passwordHash =
        process.env.GOVERNMENT_PASSWORD_HASH;

      if (!passwordHash) {
        console.error(
          "Government password hash is not configured."
        );

        return res.status(500).json({
          error:
            "Government authentication is not configured.",
        });
      }

      const passwordValid =
        await bcrypt.compare(
          password,
          passwordHash
        );

      if (!passwordValid) {
        console.warn(
          `Rejected authentication attempt for report ${req.params.reference}`
        );

        return res.status(401).json({
          error:
            "Administrator authentication failed.",
        });
      }

      /* --------------------------------------------------------
         PUBLIC MESSAGE IS REQUIRED
      -------------------------------------------------------- */

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return res.status(400).json({
          error:
            "A Public Note is required before rejecting the report.",
        });
      }

      /* --------------------------------------------------------
         FIND REPORT
      -------------------------------------------------------- */

      const report =
        await prisma.report.findUnique({
          where: {
            reference:
              req.params.reference,
          },
        });

      if (!report) {
        return res.status(404).json({
          error:
            "Report not found.",
        });
      }

      const currentStatus =
        report.status || "Submitted";

      /* --------------------------------------------------------
         FINAL SERVER-SIDE REJECTION CUTOFF
      -------------------------------------------------------- */

      if (
        currentStatus === "In Progress"
      ) {
        return res.status(400).json({
          error:
            "This report can no longer be rejected because it is already In Progress.",
        });
      }

      if (
        currentStatus === "Resolved"
      ) {
        return res.status(400).json({
          error:
            "Resolved reports cannot be rejected.",
        });
      }

      if (
        currentStatus === "Rejected"
      ) {
        return res.status(400).json({
          error:
            "This report has already been rejected.",
        });
      }

      /* --------------------------------------------------------
         SERVER-SIDE WORKFLOW VALIDATION
      -------------------------------------------------------- */

      const transitionError =
        getStatusTransitionError(
          currentStatus,
          "Rejected"
        );

      if (transitionError) {
        return res.status(400).json({
          error:
            transitionError,
        });
      }

      /* --------------------------------------------------------
         PERFORM REJECTION

         Update report status and create the public
         lifecycle event in the same transaction.
      -------------------------------------------------------- */

      const updated =
        await prisma.$transaction(
          async (tx) => {
            const rejected =
              await tx.report.update({
                where: {
                  reference:
                    req.params.reference,
                },

                data: {
                  status: "Rejected",

                  updates: {
                    create: {
                      status: "Rejected",

                      message:
                        message.trim(),

                      isPublic:
                        Boolean(isPublic),

                      photoUrl:
                        null,
                    },
                  },
                },

                include: {
                  updates: {
                    orderBy: {
                      createdAt: "asc",
                    },
                  },
                },
              });

            return rejected;
          }
        );

      /* --------------------------------------------------------
         SECURITY LOGGING

         Do NOT log the password.
      -------------------------------------------------------- */

      console.log(
        `Report ${report.reference}: ${currentStatus} → Rejected`
      );

      res.json(
        normalizeReport(updated)
      );

    } catch (error) {
      console.error(
        "Failed to reject report:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Failed to reject report.",
      });
    }
  }
);

/* =========================================================
   UPDATE REPORT STATUS
========================================================= */

app.patch(
  "/api/reports/:reference/status",
  requireGovernmentAuth,
  async (req, res) => {
    try {
      const {
        status,
        message,
        isPublic = true,
        photoUrl,
      } = req.body;

      /* -----------------------------------------
         VALIDATE STATUS
      ----------------------------------------- */

      if (
        !validStatuses.includes(status)
      ) {
        return res.status(400).json({
          error:
            "Invalid status.",
        });
      }

      /* -----------------------------------------
         FIND REPORT
      ----------------------------------------- */

      const report =
        await prisma.report.findUnique({
          where: {
            reference:
              req.params.reference,
          },
        });

      if (!report) {
        return res.status(404).json({
          error:
            "Report not found.",
        });
      }

      const currentStatus =
        report.status || "Submitted";

      /* -----------------------------------------
         SAME STATUS
      ----------------------------------------- */

      if (
        currentStatus === status
      ) {
        return res.status(400).json({
          error:
            `Report is already in ${status} status.`,
        });
      }

      /* -----------------------------------------
         PUBLIC NOTE IS REQUIRED
         FOR EVERY STATUS CHANGE
      ----------------------------------------- */

      if (
        typeof message !== "string" ||
        !message.trim()
      ) {
        return res.status(400).json({
          error:
            "A public note is required before changing the report status.",
        });
      }

      /* -----------------------------------------
         WORKFLOW VALIDATION
      ----------------------------------------- */

      const transitionError =
        getStatusTransitionError(
          currentStatus,
          status
        );

      if (transitionError) {
        return res.status(400).json({
          error:
            transitionError,
        });
      }

      /* -----------------------------------------
         ASSIGNED REQUIRES COMPLETE ROUTING
      ----------------------------------------- */

      if (
        status === "Assigned"
      ) {
        const routingComplete =
          hasCompleteRouting({
            department:
              report.department,
            assignedUnit:
              report.assignedUnit,
          });

        if (!routingComplete) {
          return res.status(400).json({
            error:
              "Complete routing before assigning this report. Department and Assigned Unit are required.",
          });
        }
      }

      /* -----------------------------------------
         UPDATE REPORT + CREATE TIMELINE EVENT
      ----------------------------------------- */

      const updated =
        await prisma.report.update({
          where: {
            reference:
              req.params.reference,
          },

          data: {
            status,

            updates: {
              create: {
                status,

                message:
                  message.trim(),

                isPublic:
                  Boolean(isPublic),

                photoUrl:
                  photoUrl || null,
              },
            },
          },

          include: {
            updates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      console.log(
        `Report ${report.reference}: ${currentStatus} → ${status}`
      );

      res.json(
        normalizeReport(updated)
      );
    } catch (error) {
      console.error(
        "Failed to update status:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Failed to update report status.",
      });
    }
  }
);

/* =========================================================
   UPDATE ASSIGNMENT
========================================================= */

app.patch(
  "/api/reports/:reference/assignment",
  requireGovernmentAuth,
  async (req, res) => {
    try {
      const {
        department,
        assignedUnit,
        priority,
      } = req.body;

      /* -----------------------------------------
         VALIDATE PRIORITY
      ----------------------------------------- */

      if (
        priority &&
        !validPriorities.includes(
          priority
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid priority.",
        });
      }

      /* -----------------------------------------
         FIND REPORT
      ----------------------------------------- */

      const existing =
        await prisma.report.findUnique({
          where: {
            reference:
              req.params.reference,
          },
        });

      if (!existing) {
        return res.status(404).json({
          error:
            "Report not found.",
        });
      }

      /* -----------------------------------------
        ASSIGNMENT CHANGES ARE ONLY PERMITTED
        DURING UNDER REVIEW
      ----------------------------------------- */

      if (existing.status !== "Under Review") {
        return res.status(400).json({
          error:
            `Assignment changes are only permitted while the report is Under Review. Current status: ${existing.status}.`,
        });
      }

      /* -----------------------------------------
         TERMINAL REPORTS CANNOT BE ROUTED
      ----------------------------------------- */

      if (
        existing.status === "Rejected"
      ) {
        return res.status(400).json({
          error:
            "Rejected reports cannot be resubmitted or reassigned.",
        });
      }

      if (
        existing.status === "Resolved"
      ) {
        return res.status(400).json({
          error:
            "Resolved reports have completed their operational lifecycle and cannot be reassigned.",
        });
      }

      /* -----------------------------------------
         NORMALIZE ROUTING VALUES
      ----------------------------------------- */

      const nextDepartment =
        department !== undefined
          ? String(department).trim()
          : existing.department || "";

      const nextAssignedUnit =
        assignedUnit !== undefined
          ? String(assignedUnit).trim()
          : existing.assignedUnit || "";

      /* -----------------------------------------
         IF REPORT IS ALREADY ASSIGNED,
         ROUTING MUST REMAIN COMPLETE
      ----------------------------------------- */

      if (
        existing.status === "Assigned" ||
        department !== undefined ||
        assignedUnit !== undefined
      ) {
        if (
          !hasCompleteRouting({
            department:
              nextDepartment,
            assignedUnit:
              nextAssignedUnit,
          })
        ) {
          return res.status(400).json({
            error:
              "Department and Assigned Unit are both required for complete routing.",
          });
        }
      }

      /* -----------------------------------------
         UPDATE REPORT
      ----------------------------------------- */

      const report =
        await prisma.report.update({
          where: {
            reference:
              req.params.reference,
          },

          data: {
            ...(department !== undefined
              ? {
                  department:
                    nextDepartment || null,
                }
              : {}),

            ...(assignedUnit !== undefined
              ? {
                  assignedUnit:
                    nextAssignedUnit || null,
                }
              : {}),

            ...(priority !== undefined
              ? {
                  priority,
                }
              : {}),
          },

          include: {
            updates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      res.json(
        normalizeReport(report)
      );
    } catch (error) {
      console.error(
        "Failed to update assignment:",
        error
      );

      if (
        error?.code === "P2025"
      ) {
        return res.status(404).json({
          error:
            "Report not found.",
        });
      }

      res.status(500).json({
        error:
          error.message ||
          "Failed to update assignment.",
      });
    }
  }
);

/* =========================================================
   ADD REPORT UPDATE
   Image is OPTIONAL for government updates.

   Image → Memory → Cloudinary → PostgreSQL
========================================================= */

app.post(
  "/api/reports/:reference/updates",
  requireGovernmentAuth,
  upload.single("photo"),
  async (req, res) => {
    try {
      const report =
        await prisma.report.findUnique({
          where: {
            reference:
              req.params.reference,
          },
        });

      if (!report) {
        return res.status(404).json({
          error:
            "Report not found.",
        });
      }

      /* -----------------------------------------
         UPLOAD OPTIONAL UPDATE IMAGE
      ----------------------------------------- */

      let photoUrl = null;

      if (req.file) {
        const uploaded =
          await uploadToCloudinary(
            req.file
          );

        if (
          !uploaded ||
          !uploaded.secure_url
        ) {
          throw new Error(
            "Cloudinary did not return a valid image URL."
          );
        }

        photoUrl =
          uploaded.secure_url;

        console.log(
          `Cloudinary update upload successful: ${photoUrl}`
        );
      }

      /* -----------------------------------------
         CREATE REPORT UPDATE
      ----------------------------------------- */

      await prisma.reportUpdate.create({
        data: {
          reportId:
            report.id,

          status:
            report.status,

          message:
            req.body.message?.trim() ||
            "Government update posted.",

          isPublic:
            req.body.isPublic !==
            "false",

          photoUrl,
        },
      });

      /* -----------------------------------------
         FETCH FRESH REPORT
      ----------------------------------------- */

      const fresh =
        await prisma.report.findUnique({
          where: {
            reference:
              req.params.reference,
          },

          include: {
            updates: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

      res.status(201).json(
        normalizeReport(fresh)
      );
    } catch (error) {
      console.error(
        "Failed to add report update:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Failed to add report update.",
      });
    }
  }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        `Route not found: ${req.method} ${req.originalUrl}`,
    });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error(
      "Unhandled request error:",
      error
    );

    /*
      Multer-specific errors
    */

    if (
      error?.code ===
      "LIMIT_FILE_SIZE"
    ) {
      return res.status(400).json({
        error:
          "Image is too large. Maximum allowed size is 5 MB.",
      });
    }

    res.status(400).json({
      error:
        error.message ||
        "Request failed.",
    });
  }
);

/* =========================================================
   DATABASE / SERVER SHUTDOWN
========================================================= */

async function shutdown(signal) {
  console.log(
    `${signal} received. Shutting down CivicPort API...`
  );

  try {
    await prisma.$disconnect();

    console.log(
      "Database connection closed."
    );

    process.exit(0);
  } catch (error) {
    console.error(
      "Error during shutdown:",
      error
    );

    process.exit(1);
  }
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `CivicPort API running on port ${PORT}`
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      `Cloudinary configured: ${
        Boolean(
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
        )
      }`
    );
  }
);
