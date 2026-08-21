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
   CLOUDINARY
========================================================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================================================
   EXPRESS
========================================================= */

app.use(cors());
app.use(express.json());

/* =========================================================
   MULTER
   Store uploads in memory temporarily.
   Images are then sent directly to Cloudinary.
========================================================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },

  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

/* =========================================================
   CLOUDINARY UPLOAD HELPER
========================================================= */

function uploadToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
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

  Do NOT prepend the Render API URL.

  Existing migrated images already look like:

  https://res.cloudinary.com/qh7nwgxh/image/upload/...

  New images will use the same format.
*/

function normalizeReport(report) {
  return {
    ...report,

    photoUrl: report.photoUrl || null,

    updates: report.updates?.map((u) => ({
      ...u,
      photoUrl: u.photoUrl || null,
    })),
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "civicport-api",
  });
});

app.get("/api/health", (_, res) => {
  res.json({
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
        "Failed to load dashboard statistics",
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
      const lat = Number(req.query.lat);
      const lon = Number(req.query.lon);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
      ) {
        return res.status(400).json({
          error:
            "Valid latitude and longitude are required.",
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

      const response = await fetch(
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

      const data = await response.json();

      const address =
        data.address || {};

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

      const reports =
        await prisma.report.findMany({
          where: {
            ...(status &&
            status !== "All"
              ? { status }
              : {}),

            ...(category &&
            category !== "All"
              ? { category }
              : {}),

            ...(q
              ? {
                  OR: [
                    {
                      title: {
                        contains: q,
                      },
                    },

                    {
                      description: {
                        contains: q,
                      },
                    },

                    {
                      locationLabel: {
                        contains: q,
                      },
                    },

                    {
                      reference: {
                        contains: q,
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
        reports.map((report) =>
          normalizeReport(report)
        )
      );
    } catch (error) {
      console.error(
        "Failed to load reports:",
        error
      );

      res.status(500).json({
        error: "Failed to load reports.",
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
            reference: req.params.reference,
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
          error: "Report not found.",
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
        error: "Failed to load report.",
      });
    }
  }
);

/* =========================================================
   CREATE NEW REPORT
   Image → Memory → Cloudinary → PostgreSQL
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

      if (
        !title ||
        !category ||
        !description
      ) {
        return res.status(400).json({
          error:
            "Title, category and description are required.",
        });
      }

      /*
        Generate reference.

        Existing references are currently based
        on the report count.
      */

      const count =
        await prisma.report.count();

      const reference =
        `CW-${String(
          125 + count
        ).padStart(6, "0")}`;

      /* -----------------------------------------
         Upload image to Cloudinary
      ----------------------------------------- */

      let photoUrl = null;

      if (req.file) {
        const uploaded =
          await uploadToCloudinary(
            req.file
          );

        photoUrl =
          uploaded.secure_url;

        console.log(
          `Cloudinary upload successful: ${photoUrl}`
        );
      }

      /* -----------------------------------------
         Create report
      ----------------------------------------- */

      const report =
        await prisma.report.create({
          data: {
            reference,

            title,

            category,

            description,

            latitude:
              latitude
                ? Number(latitude)
                : null,

            longitude:
              longitude
                ? Number(longitude)
                : null,

            locationLabel:
              locationLabel ||
              "Location captured",

            photoUrl,

            status: "Submitted",

            priority: "Medium",

            updates: {
              create: {
                status:
                  "Submitted",

                message:
                  "Report received from a citizen.",

                isPublic: true,

                photoUrl,
              },
            },
          },

          include: {
            updates: true,
          },
        });

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
          "Failed to create report.",
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
        !validStatuses.includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid status.",
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
          error: "Report not found.",
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
                  message ||
                  `Status changed to ${status}.`,

                isPublic:
                  Boolean(isPublic),

                /*
                  This endpoint currently receives
                  photoUrl directly in JSON.

                  If a future admin status update
                  needs file upload, use a separate
                  multipart endpoint or update this
                  route to use multer.
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
          error: "Invalid priority.",
        });
      }

      const report =
        await prisma.report.update({
          where: {
            reference:
              req.params.reference,
          },

          data: {
            ...(department !== undefined
              ? { department }
              : {}),

            ...(assignedUnit !== undefined
              ? { assignedUnit }
              : {}),

            ...(priority !== undefined
              ? { priority }
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
          error: "Report not found.",
        });
      }

      /* -----------------------------------------
         Upload update image to Cloudinary
      ----------------------------------------- */

      let photoUrl = null;

      if (req.file) {
        const uploaded =
          await uploadToCloudinary(
            req.file
          );

        photoUrl =
          uploaded.secure_url;

        console.log(
          `Cloudinary update upload successful: ${photoUrl}`
        );
      }

      /* -----------------------------------------
         Create report update
      ----------------------------------------- */

      await prisma.reportUpdate.create({
        data: {
          reportId: report.id,

          status: report.status,

          message:
            req.body.message ||
            "Government update posted.",

          isPublic:
            req.body.isPublic !== "false",

          photoUrl,
        },
      });

      /* -----------------------------------------
         Fetch fresh report
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
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (error, _, res, __) => {
    console.error(
      "Unhandled request error:",
      error
    );

    res.status(400).json({
      error:
        error.message ||
        "Request failed.",
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log(
    `CivicPort API running on http://localhost:${PORT}`
  );
});
