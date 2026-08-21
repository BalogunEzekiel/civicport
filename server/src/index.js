import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const uploadDir = path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const safe = file.originalname.replace(/[^a-z0-9.-]/gi, "-").toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  }
});

const validStatuses = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved", "Rejected"];
const validPriorities = ["Low", "Medium", "High", "Critical"];

function normalizeReport(report, req) {
  const base = `${req.protocol}://${req.get("host")}`;
  return {
    ...report,
    photoUrl: report.photoUrl ? `${base}${report.photoUrl}` : null,
    updates: report.updates?.map((u) => ({
      ...u,
      photoUrl: u.photoUrl ? `${base}${u.photoUrl}` : null
    }))
  };
}

app.get("/api/health", (_, res) => res.json({ ok: true, service: "CivicPort API" }));

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
        where: { status: "Resolved" },
      }),

      prisma.report.count({
        where: { status: "In Progress" },
      }),

      prisma.report.count({
        where: {
          status: {
            in: ["Submitted", "Under Review", "Assigned"],
          },
        },
      }),

      prisma.report.count({
        where: { status: "Rejected" },
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
    console.error("Failed to load statistics:", error);

    res.status(500).json({
      error: "Failed to load dashboard statistics",
    });
  }
});

app.get("/api/reports", async (req, res) => {
  const { status, category, q } = req.query;
  const reports = await prisma.report.findMany({
    where: {
      ...(status && status !== "All" ? { status } : {}),
      ...(category && category !== "All" ? { category } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { locationLabel: { contains: q } },
          { reference: { contains: q } }
        ]
      } : {})
    },
    orderBy: { createdAt: "desc" },
    include: { updates: { orderBy: { createdAt: "asc" } } }
  });
  res.json(reports.map((r) => normalizeReport(r, req)));
});

app.get("/api/reports/:reference", async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { reference: req.params.reference },
    include: { updates: { orderBy: { createdAt: "asc" } } }
  });
  if (!report) return res.status(404).json({ error: "Report not found." });
  res.json(normalizeReport(report, req));
});

app.post("/api/reports", upload.single("photo"), async (req, res) => {
  try {
    const { title, category, description, latitude, longitude, locationLabel } = req.body;
    if (!title || !category || !description) {
      return res.status(400).json({ error: "Title, category and description are required." });
    }

    const count = await prisma.report.count();
    const reference = `CW-${String(125 + count).padStart(6, "0")}`;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const report = await prisma.report.create({
      data: {
        reference,
        title,
        category,
        description,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        locationLabel: locationLabel || "Location captured",
        photoUrl,
        status: "Submitted",
        priority: "Medium",
        updates: {
          create: {
            status: "Submitted",
            message: "Report received from a citizen.",
            isPublic: true,
            photoUrl
          }
        }
      },
      include: { updates: true }
    });

    res.status(201).json(normalizeReport(report, req));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/reports/:reference/status", async (req, res) => {
  try {
    const { status, message, isPublic = true, photoUrl } = req.body;
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status." });

    const report = await prisma.report.findUnique({ where: { reference: req.params.reference } });
    if (!report) return res.status(404).json({ error: "Report not found." });

    const updated = await prisma.report.update({
      where: { reference: req.params.reference },
      data: {
        status,
        updates: {
          create: {
            status,
            message: message || `Status changed to ${status}.`,
            isPublic: Boolean(isPublic),
            photoUrl: photoUrl || null
          }
        }
      },
      include: { updates: { orderBy: { createdAt: "asc" } } }
    });

    res.json(normalizeReport(updated, req));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/reports/:reference/assignment", async (req, res) => {
  const { department, assignedUnit, priority } = req.body;
  if (priority && !validPriorities.includes(priority)) {
    return res.status(400).json({ error: "Invalid priority." });
  }

  const report = await prisma.report.update({
    where: { reference: req.params.reference },
    data: {
      ...(department !== undefined ? { department } : {}),
      ...(assignedUnit !== undefined ? { assignedUnit } : {}),
      ...(priority !== undefined ? { priority } : {})
    },
    include: { updates: { orderBy: { createdAt: "asc" } } }
  });

  res.json(normalizeReport(report, req));
});

app.post("/api/reports/:reference/updates", upload.single("photo"), async (req, res) => {
  const report = await prisma.report.findUnique({ where: { reference: req.params.reference } });
  if (!report) return res.status(404).json({ error: "Report not found." });

  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const update = await prisma.reportUpdate.create({
    data: {
      reportId: report.id,
      status: report.status,
      message: req.body.message || "Government update posted.",
      isPublic: req.body.isPublic !== "false",
      photoUrl
    }
  });

  const fresh = await prisma.report.findUnique({
    where: { reference: req.params.reference },
    include: { updates: { orderBy: { createdAt: "asc" } } }
  });

  res.status(201).json(normalizeReport(fresh, req));
});

app.use((error, _, res, __) => {
  res.status(400).json({ error: error.message || "Request failed." });
});

app.listen(PORT, () => {
  console.log(`CivicPort API running on http://localhost:${PORT}`);
});
