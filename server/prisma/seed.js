import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const reports = [
  {
    reference: "CW-000124",
    title: "Large pothole on Ikeja road",
    category: "Roads",
    description: "A deep pothole is creating a hazard for motorists near the junction.",
    latitude: 6.6018,
    longitude: 3.3515,
    locationLabel: "Ikeja, Lagos",
    status: "In Progress",
    priority: "High",
    department: "Works & Infrastructure",
    assignedUnit: "Road Maintenance Unit"
  },
  {
    reference: "CW-000123",
    title: "Broken streetlight",
    category: "Streetlights",
    description: "The streetlight has remained out at night, reducing visibility.",
    latitude: 6.5744,
    longitude: 3.3597,
    locationLabel: "Maryland, Lagos",
    status: "Under Review",
    priority: "Medium",
    department: "Electrical Services"
  },
  {
    reference: "CW-000122",
    title: "Flooding after rainfall",
    category: "Flooding",
    description: "Water accumulates across the road after heavy rainfall.",
    latitude: 6.4347,
    longitude: 3.4542,
    locationLabel: "Lekki, Lagos",
    status: "Resolved",
    priority: "High",
    department: "Environmental Services"
  },
  {
    reference: "CW-000121",
    title: "Illegal waste dumping",
    category: "Waste",
    description: "Repeated dumping has created an unhealthy public environment.",
    latitude: 6.5074,
    longitude: 3.3782,
    locationLabel: "Surulere, Lagos",
    status: "Submitted",
    priority: "Medium"
  }
];

for (const data of reports) {
  const report = await prisma.report.upsert({
    where: { reference: data.reference },
    update: data,
    create: data
  });

  const existing = await prisma.reportUpdate.count({ where: { reportId: report.id } });
  if (!existing) {
    await prisma.reportUpdate.create({
      data: {
        reportId: report.id,
        status: "Submitted",
        message: "Report received from a citizen.",
        isPublic: true
      }
    });

    if (data.status !== "Submitted") {
      await prisma.reportUpdate.create({
        data: {
          reportId: report.id,
          status: data.status,
          message:
            data.status === "Resolved"
              ? "The reported issue has been resolved."
              : data.status === "In Progress"
                ? "Repair or remediation work is underway."
                : "The report is being assessed by the responsible team.",
          isPublic: true
        }
      });
    }
  }
}

console.log("CivicPort demo data seeded.");
await prisma.$disconnect();
