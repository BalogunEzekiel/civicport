import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
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

app.use(cors());

app.use(
  express.json({
    limit: "2mb",
  })
);

/* =========================================================
   GOVERNMENT AUTHENTICATION
========================================================= */

app.post("/api/auth/government-login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  const validEmail = process.env.GOVERNMENT_EMAIL;
  const validPassword = process.env.GOVERNMENT_PASSWORD;
  const role =
    process.env.GOVERNMENT_ROLE ||
    "Government Administrator";

  // Make sure government credentials are configured
  if (!validEmail || !validPassword) {
    console.error(
      "Government authentication credentials are not configured."
    );

    return res.status(500).json({
      message:
        "Government authentication is not configured.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedValidEmail =
    validEmail.trim().toLowerCase();

  if (
    normalizedEmail !== normalizedValidEmail ||
    password !== validPassword
  ) {
    return res.status(401).json({
      message: "Invalid government credentials.",
    });
  }

  return res.json({
    success: true,
    user: {
      email: validEmail,
      role,
    },
  });
});

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
    const [
      total,
      resolved,
      progress,
      open,
      rejected,
      categories,
    ] = await Promise.all([
      prisma.report.count(),

      prisma.report.count({
        where: {
          status: "Resolved",
        },
      }),

      prisma.report.count({
        where: {
          status: "In Progress",
        },
      }),

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

      prisma.report.count({
        where: {
          status: "Rejected",
        },
      }),

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

/* =========================================================
   UPDATE REPORT STATUS
========================================================= */

app.patch(
  "/api/reports/:reference/status",
  async (req, res) => {
    try {
      const {
        status,
        message,
        isPublic = true,
        photoUrl,
      } = req.body;

      if (
        !validStatuses.includes(
          status
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid status.",
        });
      }

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
                  message?.trim() ||
                  `Status changed to ${status}.`,

                isPublic:
                  Boolean(isPublic),

                /*
                  This endpoint receives photoUrl
                  directly in JSON.

                  For admin image uploads, use
                  /updates with multipart/form-data.
                */

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
  async (req, res) => {
    try {
      const {
        department,
        assignedUnit,
        priority,
      } = req.body;

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

      const report =
        await prisma.report.update({
          where: {
            reference:
              req.params.reference,
          },

          data: {
            ...(department !==
            undefined
              ? {
                  department,
                }
              : {}),

            ...(assignedUnit !==
            undefined
              ? {
                  assignedUnit,
                }
              : {}),

            ...(priority !==
            undefined
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
        error?.code ===
        "P2025"
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