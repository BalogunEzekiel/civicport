import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  Filter,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Users,
  X,
  AlertTriangle,
  Building2,
  MapPin,
  Activity,
  ChevronRight,
  AlertOctagon,
  XCircle,
  UserCircle,
  LogOut,
} from "lucide-react";

import Logo from "../components/Logo";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Timeline from "../components/Timeline";
import { api } from "../services/api";

const STATUSES = [
  "Submitted",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
  "Rejected",
];

const STATUS_TRANSITIONS = {
  Submitted: ["Under Review", "Rejected"],
  "Under Review": ["Assigned", "Rejected"],
  Assigned: ["In Progress", "Rejected"],
  "In Progress": ["Resolved"],
  Resolved: [],
  Rejected: [],
};

const STATUS_ORDER = [
  "Submitted",
  "Under Review",
  "Assigned",
  "In Progress",
  "Resolved",
  "Rejected",
];

const PRIORITIES = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const DEFAULT_DEPARTMENTS = [
  "Works & Infrastructure",
  "Environmental Services",
  "Electrical Services",
  "Water Resources",
];

export default function AdminDashboard() {
  const [page, setPage] = useState("reports");

  const [adminUser, setAdminUser] = useState({
    email:
      sessionStorage.getItem("governmentEmail") ||
      "government.admin@civicport.gov.ng",

    role:
      sessionStorage.getItem("governmentRole") ||
      "Government Admin",
  });

  const [profileOpen, setProfileOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);

  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function load() {
    try {
      setBusy(true);

      const [s, r] = await Promise.all([
        api.stats(),
        api.reports({ q: query }),
      ]);

      setStats(s);
      setReports(Array.isArray(r) ? r : []);
    } catch (error) {
      console.error("Failed to load admin dashboard:", error);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  async function open(reference) {
    try {
      setSelected(await api.report(reference));
    } catch (error) {
      console.error("Failed to open report:", error);
    }
  }

  async function changeStatus(status, message) {
    if (!selected?.reference) return;

    const currentStatus =
      selected.status || "Submitted";

    const transitionError =
      getStatusTransitionError(
        currentStatus,
        status
      );

    if (transitionError) {
      window.alert(transitionError);
      return;
    }

    // Assigned requires completed routing.
    if (status === "Assigned") {
      const routingComplete =
        hasCompleteRouting({
          department: selected.department,
          assignedUnit: selected.assignedUnit,
        });

      if (!routingComplete) {
        window.alert(
          "Routing is required before this report can be assigned. Please select a department and enter the assigned unit."
        );

        return;
      }
    }

    try {
      setBusy(true);

      const updated =
        await api.updateStatus(
          selected.reference,
          {
            status,
            message,
            isPublic: true,
          }
        );

      setSelected(updated);

      await load();

    } catch (error) {
      console.error(
        "Failed to update status:",
        error
      );

      window.alert(
        error?.message ||
          "Unable to update report status."
      );

    } finally {
      setBusy(false);
    }
  }

  async function assign(data) {
    if (!selected?.reference) return;

    try {
      const updated = await api.assignment(
        selected.reference,
        data
      );

      setSelected(updated);
      await load();
    } catch (error) {
      console.error("Failed to update assignment:", error);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("governmentAuthenticated");
    sessionStorage.removeItem("governmentEmail");
    sessionStorage.removeItem("governmentRole");

    window.location.href = "/government-login";
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setSidebarOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  const pageTitle = {
    reports: "Operations Dashboard",
    analytics: "Analytics & Intelligence",
    departments: "Departments & Workload",
  }[page];

  const pageDescription = {
    reports:
      "Review, route and resolve civic reports.",
    analytics:
      "Understand reporting trends, service performance and operational pressure.",
    departments:
      "Monitor departmental workload, priorities and resolution performance.",
  }[page];

  return (
    <div className="admin-shell">
      <button
        type="button"
        className={`sidebar-backdrop ${
          sidebarOpen ? "show" : ""
        }`}
        aria-label="Close navigation"
        onClick={closeSidebar}
      />

      <aside
        id="government-sidebar"
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
        aria-label="Government portal navigation"
      >
        <div className="sidebar-header">
          <Logo light />

          <button
            type="button"
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Close navigation"
          >
            <X size={22} />
          </button>
        </div>

        <div className="side-label">OPERATIONS</div>

        <nav className="sidebar-nav">
          <SidebarLink
            active={page === "reports"}
            icon={<ClipboardList size={18} />}
            label="Reports"
            onClick={() => navigate("reports")}
          />

          <SidebarLink
            active={page === "analytics"}
            icon={<BarChart3 size={18} />}
            label="Analytics"
            onClick={() => navigate("analytics")}
          />

          <SidebarLink
            active={page === "departments"}
            icon={<ShieldCheck size={18} />}
            label="Departments"
            onClick={() => navigate("departments")}
          />
        </nav>

        <div className="sidebar-bottom">

          <div className="government-profile">

            <button
              type="button"
              className="government-profile-trigger"
              onClick={() =>
                setProfileOpen((current) => !current)
              }
              aria-expanded={profileOpen}
              aria-controls="government-profile-panel"
            >
              <div className="government-avatar">
                <UserCircle size={22} />
              </div>

              <div className="government-profile-summary">
                <strong>Government Admini</strong>

                <span>
                  {adminUser.email}
                </span>
              </div>

              <ChevronRight
                size={16}
                className={`profile-chevron ${
                  profileOpen ? "profile-chevron-open" : ""
                }`}
              />
            </button>


            {profileOpen && (
              <div
                id="government-profile-panel"
                className="government-profile-panel"
              >

                <div className="profile-panel-header">

                  <div className="profile-panel-avatar">
                    <ShieldCheck size={21} />
                  </div>

                  <div>
                    <strong>Government Portal</strong>

                    <span>
                      Authenticated administrator
                    </span>
                  </div>

                </div>


                <div className="profile-detail">

                  <span className="profile-detail-label">
                    EMAIL
                  </span>

                  <strong>
                    {adminUser.email}
                  </strong>

                </div>


                <div className="profile-detail">

                  <span className="profile-detail-label">
                    ACCESS LEVEL
                  </span>

                  <strong>
                    {adminUser.role}
                  </strong>

                </div>


                <div className="profile-status">

                  <span className="profile-status-dot" />

                  <span>
                    Active session
                  </span>

                </div>


                <button
                  type="button"
                  className="government-logout"
                  onClick={handleLogout}
                >
                  <LogOut size={17} />

                  <span>
                    Sign out securely
                  </span>
                </button>

              </div>
            )}

          </div>

        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div className="admin-title-group">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              aria-controls="government-sidebar"
            >
              <Menu size={24} />
            </button>

            <div>
              <div className="eyebrow">
                GOVERNMENT PORTAL
              </div>

              <h1>{pageTitle}</h1>

              <p>{pageDescription}</p>
            </div>
          </div>

          <button
            className="btn btn-outline refresh-button"
            onClick={load}
            disabled={busy}
          >
            <RefreshCw
              size={16}
              className={busy ? "spin" : ""}
            />

            <span>
              {busy ? "Refreshing..." : "Refresh"}
            </span>
          </button>
        </header>

        {page === "reports" && (
          <ReportsPage
            stats={stats}
            reports={reports}
            query={query}
            setQuery={setQuery}
            busy={busy}
            load={load}
            open={open}
          />
        )}

        {page === "analytics" && (
          <AnalyticsPage
            reports={reports}
            stats={stats}
            busy={busy}
          />
        )}

        {page === "departments" && (
          <DepartmentsPage
            reports={reports}
            busy={busy}
            open={open}
            onGoToReports={() => navigate("reports")}
          />
        )}

        {selected && (
          <AdminModal
            report={selected}
            onClose={() => setSelected(null)}
            onStatus={changeStatus}
            onAssign={assign}
          />
        )}
      </main>
    </div>
  );
}

/* ============================================================
   SIDEBAR
============================================================ */

function SidebarLink({
  active,
  icon,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`sidebar-link ${
        active ? "active" : ""
      }`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ============================================================
   REPORTS
============================================================ */

function ReportsPage({
  stats,
  reports,
  query,
  setQuery,
  busy,
  load,
  open,
}) {
  const activeReports = reports.filter(
    (report) => report.status !== "Rejected"
  );

  const unassignedCount = activeReports.filter(
    (report) =>
      !report.department ||
      report.department.trim() === ""
  ).length;

  const assignedCount = activeReports.filter(
    (report) =>
      report.department &&
      report.department.trim() !== ""
  ).length;

  return (
    <>
      <section className="admin-kpis">

        <Kpi
          icon={<ClipboardList />}
          label="Total Reports"
          value={stats?.total ?? reports.length}
        />

        <Kpi
          icon={<AlertTriangle />}
          label="Unassigned"
          value={unassignedCount}
        />

        <Kpi
          icon={<Eye />}
          label="Assigned"
          value={assignedCount}
        />

        <Kpi
          icon={<RefreshCw />}
          label="In Progress"
          value={
            stats?.progress ??
            countStatus(reports, ["In Progress"])
          }
        />

        <Kpi
          icon={<CheckCircle2 />}
          label="Resolved"
          value={
            stats?.resolved ??
            countStatus(reports, ["Resolved"])
          }
        />

        <Kpi
          icon={<X />}
          label="Rejected"
          value={
            stats?.rejected ??
            countStatus(reports, ["Rejected"])
          }
          variant="rejected"
        />

      </section>

      <section className="admin-card">
        <div className="table-toolbar">
          <div>
            <h2>Report queue</h2>
            <span>{reports.length} records</span>
          </div>

          <label className="search">
            <Search size={17} />

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              onKeyDown={(e) =>
                e.key === "Enter" && load()
              }
              placeholder="Search reports..."
              aria-label="Search reports"
            />
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Issue</th>
                <th>Location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {reports.map((r) => (
                <tr key={r.reference}>
                  <td>
                    <strong>{r.reference}</strong>
                  </td>

                  <td>
                    <strong>{r.title}</strong>
                    <small>{r.category}</small>
                  </td>

                  <td>
                    {r.locationLabel || "—"}
                  </td>

                  <td>
                    <PriorityBadge
                      priority={r.priority}
                    />
                  </td>

                  <td>
                    <StatusBadge
                      status={r.status}
                    />
                  </td>

                  <td>
                    {formatDate(r.updatedAt)}
                  </td>

                  <td>
                    <button
                      className="icon-button"
                      onClick={() =>
                        open(r.reference)
                      }
                      aria-label={`View ${r.reference}`}
                    >
                      <Eye size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {busy && (
            <div className="loading">
              Refreshing...
            </div>
          )}

          {!busy && reports.length === 0 && (
            <div className="loading">
              No reports found.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/* ============================================================
   ANALYTICS PAGE
============================================================ */

function AnalyticsPage({
  reports,
  stats,
  busy,
}) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  const departments = useMemo(() => {
    return uniqueSorted(
      reports.map((r) => r.department).filter(Boolean)
    );
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const statusMatch =
        statusFilter === "All" ||
        report.status === statusFilter;

      const priorityMatch =
        priorityFilter === "All" ||
        report.priority === priorityFilter;

      const departmentMatch =
        departmentFilter === "All" ||
        report.department === departmentFilter;

      return (
        statusMatch &&
        priorityMatch &&
        departmentMatch
      );
    });
  }, [
    reports,
    statusFilter,
    priorityFilter,
    departmentFilter,
  ]);

  const analytics = useMemo(
    () => buildAnalytics(filteredReports),
    [filteredReports]
  );

  const resolutionRate =
    analytics.total > 0
      ? Math.round(
          (analytics.resolved / analytics.total) * 100
        )
      : 0;

  return (
    <>
      {/* ==========================================================
          ANALYTICS CSS
      =========================================================== */}

      <style>{`

        /* ==========================================================
           ANALYTICS PAGE
        =========================================================== */

        .analytics-page {
          width: 100%;
          max-width: 100%;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
        }

        .analytics-page *,
        .analytics-page *::before,
        .analytics-page *::after {
          box-sizing: border-box;
        }


        /* ==========================================================
           FILTER CARD
        =========================================================== */

        .analytics-filter-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;

          width: 100%;
          padding: 18px 20px;
          margin-bottom: 20px;

          background: var(--surface, #ffffff);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 16px;

          box-shadow:
            0 4px 16px rgba(15, 23, 42, 0.04);
        }

        .analytics-filter-title {
          display: flex;
          align-items: center;
          gap: 12px;

          min-width: 200px;
        }

        .filter-icon {
          width: 36px;
          height: 36px;

          display: flex;
          align-items: center;
          justify-content: center;

          flex: 0 0 36px;

          color: var(--primary, #2563eb);
          background: rgba(37, 99, 235, 0.09);

          border-radius: 10px;
        }

        .analytics-filter-title strong {
          display: block;

          color: var(--text-primary, #172033);

          font-size: 14px;
          font-weight: 700;
          line-height: 1.25;
        }

        .analytics-filter-title span {
          display: block;

          margin-top: 3px;

          color: var(--text-muted, #64748b);

          font-size: 12px;
          line-height: 1.4;
        }

        .analytics-filters {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;

          gap: 12px;

          flex: 1;
          flex-wrap: wrap;
        }

        .analytics-filters .filter-select {
          min-width: 150px;
        }

        .filter-reset {
          height: 40px;

          padding: 0 16px;

          border: 1px solid var(--border, #dfe3e8);
          border-radius: 10px;

          background: #ffffff;
          color: var(--text-secondary, #475569);

          font-size: 13px;
          font-weight: 700;

          cursor: pointer;

          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            color 0.18s ease,
            transform 0.18s ease;
        }

        .filter-reset:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: var(--text-primary, #172033);
        }

        .filter-reset:active {
          transform: translateY(1px);
        }


        /* ==========================================================
           SUMMARY GRID
        =========================================================== */

        .analytics-summary-grid {
          display: grid;

          grid-template-columns:
            repeat(4, minmax(0, 1fr));

          gap: 16px;

          margin-bottom: 20px;
        }


        /* ==========================================================
           ANALYTICS METRIC
        =========================================================== */

        .analytics-metric {
          position: relative;

          min-width: 0;

          padding: 18px;

          background: var(--surface, #ffffff);

          border: 1px solid var(--border, #e5e7eb);
          border-radius: 16px;

          box-shadow:
            0 4px 16px rgba(15, 23, 42, 0.035);
        }

        .analytics-metric-icon {
          width: 38px;
          height: 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          margin-bottom: 13px;

          color: var(--primary, #2563eb);

          background: rgba(37, 99, 235, 0.09);

          border-radius: 10px;
        }

        .analytics-metric-label {
          margin-bottom: 5px;

          color: var(--text-muted, #64748b);

          font-size: 12px;
          font-weight: 600;
        }

        .analytics-metric-value {
          color: var(--text-primary, #172033);

          font-size: 26px;
          font-weight: 800;

          line-height: 1.1;

          letter-spacing: -0.02em;
        }

        .analytics-metric-detail {
          margin-top: 7px;

          color: var(--text-muted, #64748b);

          font-size: 12px;
          line-height: 1.4;
        }

        .analytics-metric.danger
        .analytics-metric-icon {
          color: #dc2626;
          background: rgba(220, 38, 38, 0.09);
        }

        .analytics-metric.danger
        .analytics-metric-value {
          color: #dc2626;
        }


        /* ==========================================================
           OPERATIONAL INTELLIGENCE
        =========================================================== */

        .analytics-intelligence {
          margin-bottom: 20px;

          padding: 22px;

          background:
            linear-gradient(
              135deg,
              rgba(37, 99, 235, 0.055),
              rgba(99, 102, 241, 0.025)
            );

          border:
            1px solid rgba(37, 99, 235, 0.12);

          border-radius: 18px;
        }

        .analytics-intelligence-header {
          display: flex;

          align-items: flex-start;
          justify-content: space-between;

          gap: 20px;

          margin-bottom: 20px;
        }

        .analytics-intelligence-header
        .eyebrow {
          display: block;

          margin-bottom: 5px;

          color: var(--primary, #2563eb);

          font-size: 10px;
          font-weight: 800;

          letter-spacing: 0.12em;
        }

        .analytics-intelligence-header h2 {
          margin: 0;

          color: var(--text-primary, #172033);

          font-size: 20px;
          font-weight: 800;

          letter-spacing: -0.02em;
        }

        .analytics-intelligence-header p {
          margin: 6px 0 0;

          color: var(--text-muted, #64748b);

          font-size: 13px;
        }

        .analytics-intelligence-header > svg {
          flex: 0 0 auto;

          color: var(--primary, #2563eb);
        }

        .intelligence-grid {
          display: grid;

          grid-template-columns:
            repeat(4, minmax(0, 1fr));

          gap: 12px;
        }

        .intelligence-item {
          min-width: 0;

          padding: 15px;

          background:
            rgba(255, 255, 255, 0.78);

          border:
            1px solid rgba(148, 163, 184, 0.18);

          border-radius: 13px;
        }

        .intelligence-item-label {
          color: var(--text-muted, #64748b);

          font-size: 11px;
          font-weight: 700;
        }

        .intelligence-item-value {
          margin: 6px 0;

          color: var(--text-primary, #172033);

          font-size: 23px;
          font-weight: 800;
        }

        .intelligence-item-description {
          color: var(--text-secondary, #475569);

          font-size: 11px;
          line-height: 1.45;
        }

        .intelligence-item.positive
        .intelligence-item-value {
          color: #15803d;
        }

        .intelligence-item.warning
        .intelligence-item-value {
          color: #b45309;
        }

        .intelligence-item.danger
        .intelligence-item-value {
          color: #dc2626;
        }


        /* ==========================================================
           ANALYTICS GRID
        =========================================================== */

        .analytics-grid {
          display: grid;

          grid-template-columns:
            minmax(0, 1.65fr)
            minmax(300px, 1fr);

          gap: 18px;

          margin-bottom: 20px;
        }


        /* ==========================================================
           ANALYTICS CARD
        =========================================================== */

        .analytics-card {
          min-width: 0;

          padding: 20px;

          background: var(--surface, #ffffff);

          border:
            1px solid var(--border, #e5e7eb);

          border-radius: 16px;

          box-shadow:
            0 4px 16px rgba(15, 23, 42, 0.035);
        }

        .analytics-card-large {
          min-width: 0;
        }

        .analytics-card-header {
          display: flex;

          align-items: flex-start;
          justify-content: space-between;

          gap: 15px;

          margin-bottom: 20px;
        }

        .analytics-card-header h3 {
          margin: 0;

          color: var(--text-primary, #172033);

          font-size: 15px;
          font-weight: 800;
        }

        .analytics-card-header p {
          margin: 4px 0 0;

          color: var(--text-muted, #64748b);

          font-size: 11px;
          line-height: 1.45;
        }


        /* ==========================================================
           STATUS CHART
        =========================================================== */

        .status-chart {
          display: flex;
          flex-direction: column;

          gap: 16px;
        }

        .status-chart-row {
          display: grid;

          grid-template-columns:
            115px
            minmax(0, 1fr)
            45px;

          align-items: center;

          gap: 12px;
        }

        .chart-label {
          display: flex;

          align-items: center;
          justify-content: space-between;

          gap: 8px;

          color: var(--text-secondary, #475569);

          font-size: 12px;
        }

        .chart-label strong {
          color: var(--text-primary, #172033);

          font-size: 12px;
        }

        .bar-track {
          height: 9px;

          overflow: hidden;

          background: #eef2f7;

          border-radius: 999px;
        }

        .bar-fill {
          height: 100%;

          min-width: 0;

          border-radius: inherit;

          transition:
            width 0.35s ease;
        }

        .status-bar-submitted {
          background: #64748b;
        }

        .status-bar-under-review {
          background: #2563eb;
        }

        .status-bar-in-progress {
          background: #7c3aed;
        }

        .status-bar-resolved {
          background: #16a34a;
        }

        .status-bar-rejected {
          background: #dc2626;
        }

        .chart-percent {
          text-align: right;

          color: var(--text-muted, #64748b);

          font-size: 11px;
          font-weight: 700;
        }


        /* ==========================================================
           PRIORITY PROFILE
        =========================================================== */

        .priority-profile {
          display: flex;
          flex-direction: column;

          gap: 18px;
        }

        .priority-profile-row {
          display: grid;

          grid-template-columns:
            92px
            minmax(0, 1fr)
            32px;

          align-items: center;

          gap: 10px;
        }

        .priority-profile-track {
          height: 8px;

          overflow: hidden;

          background: #eef2f7;

          border-radius: 999px;
        }

        .priority-profile-fill {
          height: 100%;

          min-width: 4px;

          border-radius: inherit;

          transition:
            width 0.35s ease;
        }

        .priority-fill-low {
          background: #16a34a;
        }

        .priority-fill-medium {
          background: #2563eb;
        }

        .priority-fill-high {
          background: #f59e0b;
        }

        .priority-fill-critical {
          background: #dc2626;
        }

        .priority-profile-row > strong {
          text-align: right;

          color: var(--text-primary, #172033);

          font-size: 12px;
        }


        /* ==========================================================
           DEPARTMENT BARS
        =========================================================== */

        .department-bars {
          display: flex;
          flex-direction: column;

          gap: 15px;
        }

        .department-bar-row {
          display: grid;

          grid-template-columns:
            150px
            minmax(0, 1fr)
            35px;

          align-items: center;

          gap: 12px;
        }

        .department-bar-label {
          overflow: hidden;

          color: var(--text-secondary, #475569);

          font-size: 12px;
          font-weight: 600;

          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .department-bar-track {
          height: 8px;

          overflow: hidden;

          background: #eef2f7;

          border-radius: 999px;
        }

        .department-bar-fill {
          height: 100%;

          background:
            var(--primary, #2563eb);

          border-radius: inherit;

          transition:
            width 0.35s ease;
        }

        .department-bar-value {
          text-align: right;

          color: var(--text-primary, #172033);

          font-size: 12px;
          font-weight: 800;
        }


        /* ==========================================================
           CATEGORY RANKING
        =========================================================== */

        .category-ranking {
          display: flex;
          flex-direction: column;

          gap: 13px;
        }

        .category-ranking-row {
          display: grid;

          grid-template-columns:
            25px
            minmax(0, 1fr)
            35px;

          align-items: center;

          gap: 9px;
        }

        .category-ranking-position {
          color: var(--text-muted, #94a3b8);

          font-size: 11px;
          font-weight: 800;
        }

        .category-ranking-name {
          overflow: hidden;

          color: var(--text-secondary, #475569);

          font-size: 12px;
          font-weight: 600;

          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .category-ranking-value {
          text-align: right;

          color: var(--text-primary, #172033);

          font-size: 12px;
          font-weight: 800;
        }


        /* ==========================================================
           RECENT ACTIVITY
        =========================================================== */

        .analytics-card > .recent-activity {
          width: 100%;
        }

        .recent-activity {
          display: flex;
          flex-direction: column;
        }

        .recent-activity-row {
          display: grid;

          grid-template-columns:
            38px
            minmax(0, 1fr)
            auto;

          align-items: center;

          gap: 12px;

          padding: 13px 0;

          border-bottom:
            1px solid #eef2f7;
        }

        .recent-activity-row:last-child {
          border-bottom: 0;

          padding-bottom: 0;
        }

        .recent-activity-icon {
          width: 34px;
          height: 34px;

          display: flex;
          align-items: center;
          justify-content: center;

          color: var(--primary, #2563eb);

          background:
            rgba(37, 99, 235, 0.08);

          border-radius: 9px;
        }

        .recent-activity-main {
          min-width: 0;
        }

        .recent-activity-title {
          overflow: hidden;

          color: var(--text-primary, #172033);

          font-size: 12px;
          font-weight: 700;

          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .recent-activity-meta {
          margin-top: 3px;

          color: var(--text-muted, #64748b);

          font-size: 11px;
        }

        .recent-activity-time {
          color: var(--text-muted, #94a3b8);

          font-size: 10px;

          white-space: nowrap;
        }


        /* ==========================================================
           DATA NOTE
        =========================================================== */

        .analytics-data-note {
          display: flex;

          align-items: center;

          gap: 8px;

          margin-top: 16px;

          padding: 11px 14px;

          color: var(--text-muted, #64748b);

          background: #f8fafc;

          border:
            1px solid #e8edf3;

          border-radius: 10px;

          font-size: 11px;
        }

        .analytics-data-note svg {
          flex: 0 0 auto;
        }


        /* ==========================================================
           EMPTY STATES
        =========================================================== */

        .analytics-empty {
          display: flex;

          align-items: center;
          justify-content: center;

          min-height: 120px;

          color: var(--text-muted, #64748b);

          font-size: 13px;

          text-align: center;
        }


        /* ==========================================================
           RESPONSIVE — 1200px
        =========================================================== */

        @media (max-width: 1200px) {

          .analytics-summary-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

          .intelligence-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }

        }


        /* ==========================================================
           RESPONSIVE — 900px
        =========================================================== */

        @media (max-width: 900px) {

          .analytics-filter-card {
            align-items: flex-start;

            flex-direction: column;
          }

          .analytics-filters {
            width: 100%;

            justify-content: flex-start;
          }

          .analytics-grid {
            grid-template-columns: 1fr;
          }

        }


        /* ==========================================================
           RESPONSIVE — 640px
        =========================================================== */

        @media (max-width: 640px) {

          .analytics-summary-grid {
            grid-template-columns: 1fr;
          }

          .intelligence-grid {
            grid-template-columns: 1fr;
          }

          .analytics-card,
          .analytics-intelligence,
          .analytics-filter-card {
            padding: 15px;

            border-radius: 13px;
          }

          .analytics-filters {
            display: grid;

            grid-template-columns: 1fr;

            width: 100%;
          }

          .analytics-filters .filter-select {
            width: 100%;

            min-width: 0;
          }

          .filter-reset {
            width: 100%;
          }

          .status-chart-row {
            grid-template-columns:
              95px
              minmax(0, 1fr)
              38px;

            gap: 8px;
          }

          .priority-profile-row {
            grid-template-columns:
              78px
              minmax(0, 1fr)
              28px;

            gap: 8px;
          }

          .department-bar-row {
            grid-template-columns:
              105px
              minmax(0, 1fr)
              30px;

            gap: 8px;
          }

          .analytics-intelligence-header h2 {
            font-size: 18px;
          }

        }

      `}</style>


      {/* ==========================================================
          ANALYTICS CONTENT
      =========================================================== */}

      <div className="analytics-page">

        {/* ========================================================
            FILTERS
        ========================================================= */}

        <section className="analytics-filter-card">

          <div className="analytics-filter-title">

            <div className="filter-icon">
              <Filter size={17} />
            </div>

            <div>

              <strong>
                Analytics filters
              </strong>

              <span>
                Narrow the operational view
              </span>

            </div>

          </div>


          <div className="analytics-filters">

            <FilterSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                "All",
                ...STATUSES,
              ]}
            />


            <FilterSelect
              label="Priority"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={[
                "All",
                ...PRIORITIES,
              ]}
            />


            <FilterSelect
              label="Department"
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={[
                "All",
                ...departments,
              ]}
            />


            <button
              className="filter-reset"
              onClick={() => {
                setStatusFilter("All");
                setPriorityFilter("All");
                setDepartmentFilter("All");
              }}
            >
              Reset
            </button>

          </div>

        </section>


        {/* ========================================================
            SUMMARY METRICS
        ========================================================= */}

        <section className="analytics-summary-grid">

          <AnalyticsMetric
            icon={<Activity />}
            label="Reports analysed"
            value={analytics.total}
            detail={
              busy
                ? "Refreshing data..."
                : "Current dataset"
            }
          />


          <AnalyticsMetric
            icon={<CheckCircle2 />}
            label="Resolution rate"
            value={`${resolutionRate}%`}
            detail={`${analytics.resolved} resolved`}
          />


          <AnalyticsMetric
            icon={<AlertTriangle />}
            label="High priority"
            value={
              analytics.priority.High +
              analytics.priority.Critical
            }
            detail="High + critical"
            danger={
              analytics.priority.High +
                analytics.priority.Critical >
              0
            }
          />


          <AnalyticsMetric
            icon={<Clock3 />}
            label="Open workload"
            value={
              analytics.total -
              analytics.resolved -
              analytics.rejected
            }
            detail="Requires attention"
          />

        </section>


        {/* ========================================================
            OPERATIONAL INTELLIGENCE
        ========================================================= */}

        <section className="analytics-intelligence">

          <div className="analytics-intelligence-header">

            <div>

              <span className="eyebrow">
                OPERATIONAL INTELLIGENCE
              </span>

              <h2>
                Service delivery signals
              </h2>

              <p>
                Key indicators derived from the
                current report workload.
              </p>

            </div>

            <TrendingUp size={22} />

          </div>


          <div className="intelligence-grid">

            <IntelligenceItem
              label="Resolution performance"
              value={`${resolutionRate}%`}
              description={
                resolutionRate >= 80
                  ? "Strong resolution performance"
                  : resolutionRate >= 50
                  ? "Moderate resolution performance"
                  : "Resolution performance needs attention"
              }
              tone={
                resolutionRate >= 80
                  ? "positive"
                  : resolutionRate >= 50
                  ? "warning"
                  : "danger"
              }
            />


            <IntelligenceItem
              label="Critical exposure"
              value={analytics.critical}
              description={
                analytics.critical > 0
                  ? "Critical reports require escalation"
                  : "No critical reports detected"
              }
              tone={
                analytics.critical > 0
                  ? "danger"
                  : "positive"
              }
            />


            <IntelligenceItem
              label="Active workload"
              value={analytics.active}
              description="Reports not yet resolved or rejected"
              tone={
                analytics.active > 10
                  ? "warning"
                  : "neutral"
              }
            />


            <IntelligenceItem
              label="High priority"
              value={analytics.high}
              description="High-priority cases requiring monitoring"
              tone={
                analytics.high > 0
                  ? "warning"
                  : "positive"
              }
            />

          </div>

        </section>


        {/* ========================================================
            STATUS + PRIORITY
        ========================================================= */}

        <section className="analytics-grid">

          <div className="analytics-card analytics-card-large">

            <AnalyticsCardHeader
              title="Report Status Distribution"
              subtitle="Current operational workload"
            />


            <div className="status-chart">

              {STATUSES.map((status) => {

                const value =
                  analytics.status[status] || 0;

                const percent =
                  analytics.total > 0
                    ? Math.round(
                        (value /
                          analytics.total) *
                          100
                      )
                    : 0;

                return (

                  <div
                    className="status-chart-row"
                    key={status}
                  >

                    <div className="chart-label">

                      <span>
                        {status}
                      </span>

                      <strong>
                        {value}
                      </strong>

                    </div>


                    <div className="bar-track">

                      <div
                        className={`bar-fill status-bar-${slug(
                          status
                        )}`}
                        style={{
                          width: `${percent}%`,
                        }}
                      />

                    </div>


                    <span className="chart-percent">
                      {percent}%
                    </span>

                  </div>

                );

              })}

            </div>

          </div>


          <div className="analytics-card">

            <AnalyticsCardHeader
              title="Priority Profile"
              subtitle="Severity distribution"
            />


            <div className="priority-profile">

              {PRIORITIES.map((priority) => {

                const value =
                  analytics.priority[priority] || 0;

                return (

                  <div
                    className="priority-profile-row"
                    key={priority}
                  >

                    <PriorityBadge
                      priority={priority}
                    />


                    <div className="priority-profile-track">

                      <div
                        className={`priority-profile-fill priority-fill-${priority.toLowerCase()}`}
                        style={{
                          width: `${
                            analytics.total
                              ? Math.max(
                                  4,
                                  (value /
                                    analytics.total) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />

                    </div>


                    <strong>
                      {value}
                    </strong>

                  </div>

                );

              })}

            </div>

          </div>

        </section>


        {/* ========================================================
            DEPARTMENT + CATEGORIES
        ========================================================= */}

        <section className="analytics-grid">

          <div className="analytics-card analytics-card-large">

            <AnalyticsCardHeader
              title="Department workload"
              subtitle="Reports currently attributed to each department"
            />

            <DepartmentBars
              reports={filteredReports}
            />

          </div>


          <div className="analytics-card">

            <AnalyticsCardHeader
              title="Top issue categories"
              subtitle="Most frequently reported issues"
            />

            <CategoryRanking
              reports={filteredReports}
            />

          </div>

        </section>


        {/* ========================================================
            RECENT ACTIVITY
        ========================================================= */}

        <section className="analytics-card">

          <AnalyticsCardHeader
            title="Recent activity"
            subtitle="Latest report updates"
          />

          <RecentActivity
            reports={filteredReports}
          />

        </section>


        {/* ========================================================
            DATA NOTE
        ========================================================= */}

        {stats && (

          <div className="analytics-data-note">

            <Activity size={15} />

            <span>
              Analytics are calculated from the
              current report dataset and refreshed
              from the administration API.
            </span>

          </div>

        )}

      </div>
    </>
  );
}

function IntelligenceItem({
  label,
  value,
  description,
  tone = "neutral",
}) {
  return (
    <div
      className={`intelligence-item intelligence-${tone}`}
    >
      <span>{label}</span>

      <strong>{value}</strong>

      <small>{description}</small>
    </div>
  );
}

/* ============================================================
   DEPARTMENTS
============================================================ */

function DepartmentsPage({
  reports,
  busy,
  open,
  onGoToReports,
}) {
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] =
    useState(null);

  const departmentData = useMemo(() => {
    return buildDepartmentData(reports);
  }, [reports]);

  const filteredDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return departmentData;

    return departmentData.filter((department) =>
      department.name
        .toLowerCase()
        .includes(q)
    );
  }, [departmentData, search]);

  const selectedData = departmentData.find(
    (d) => d.name === selectedDepartment
  );

  const totals = useMemo(() => {
    return departmentData.reduce(
      (acc, department) => {
        acc.reports += department.total;
        acc.open += department.open;
        acc.resolved += department.resolved;
        acc.critical += department.critical;
        return acc;
      },
      {
        reports: 0,
        open: 0,
        resolved: 0,
        critical: 0,
      }
    );
  }, [departmentData]);

  return (
    <div className="departments-page">
      <section className="department-overview">
        <div>
          <div className="eyebrow">
            SERVICE DELIVERY
          </div>

          <h2>Department Command Centre</h2>

          <p>
            Monitor workload, response pressure and
            resolution performance across government
            departments.
          </p>
        </div>

        <div className="department-total">
          <Building2 size={20} />
          <div>
            <strong>
              {departmentData.length}
            </strong>
            <span>Active departments</span>
          </div>
        </div>
      </section>

      <section className="department-summary-grid">
        <Kpi
          icon={<ClipboardList />}
          label="Attributed reports"
          value={totals.reports}
        />

        <Kpi
          icon={<Clock3 />}
          label="Open workload"
          value={totals.open}
        />

        <Kpi
          icon={<CheckCircle2 />}
          label="Resolved"
          value={totals.resolved}
        />

        <Kpi
          icon={<AlertTriangle />}
          label="Critical"
          value={totals.critical}
          variant={
            totals.critical > 0
              ? "rejected"
              : ""
          }
        />
      </section>

      {/* ============================================================
          UNASSIGNED REPORTS
      ============================================================ */}

      {(() => {
        const unassignedCount = reports.filter(
          (report) =>
            !report.department ||
            report.department.trim() === ""
        ).length;

        return (
          <button
            type="button"
            className="admin-card unassigned-card"
            onClick={onGoToReports}
          >
            <div className="unassigned-card-icon">
              <AlertTriangle size={20} />
            </div>

            <div className="unassigned-card-content">
              <span>Unassigned Reports</span>

              <strong>{unassignedCount}</strong>

              <small>
                Awaiting departmental assignment
              </small>
            </div>

            <ChevronRight
              size={20}
              className="unassigned-card-arrow"
            />
          </button>
        );
      })()}


      {/* ============================================================
          DEPARTMENT PERFORMANCE
      ============================================================ */}

      <section className="admin-card departments-card">
        <div className="table-toolbar">
          <div>
            <h2>Department Performance</h2>

            <span>
              {filteredDepartments.length} departments
            </span>
          </div>

          <label className="search">
            <Search size={17} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search departments..."
              aria-label="Search departments"
            />
          </label>
        </div>

        <div className="department-grid">
          {filteredDepartments.map(
            (department) => (
              <DepartmentCard
                key={department.name}
                department={department}
                onClick={() =>
                  setSelectedDepartment(
                    department.name
                  )
                }
              />
            )
          )}

          {!busy &&
            filteredDepartments.length === 0 && (
              <div className="department-empty">
                <Building2 size={30} />

                <strong>
                  No departments found
                </strong>

                <span>
                  Try another search term.
                </span>
              </div>
            )}
        </div>
      </section>

      {selectedData && (
        <DepartmentDetail
          department={selectedData}
          reports={reports}
          open={open}
          onClose={() =>
            setSelectedDepartment(null)
          }
          onGoToReports={onGoToReports}
        />
      )}
    </div>
  );
}

/* ============================================================
   DEPARTMENT CARD
============================================================ */

function DepartmentCard({
  department,
  onClick,
}) {
  const {
    resolutionRate,
    pressure,
    health,
  } = getDepartmentMetrics(department);

  return (
    <button
      type="button"
      className="department-card"
      onClick={onClick}
    >
      <div className="department-card-top">
        <div className="department-icon">
          <Building2 size={20} />
        </div>

        <span
          className={`department-health department-health-${slug(
            health
          )}`}
        >
          {health}
        </span>

        <ChevronRight size={18} />
      </div>

      <div className="department-card-name">
        {department.name}
      </div>

      <div className="department-card-stats">
        <div>
          <strong>{department.total}</strong>
          <span>Total</span>
        </div>

        <div>
          <strong>{department.open}</strong>
          <span>Open</span>
        </div>

        <div>
          <strong>{resolutionRate}%</strong>
          <span>Resolved</span>
        </div>
      </div>

      <div className="department-progress">
        <div
          style={{
            width: `${resolutionRate}%`,
          }}
        />
      </div>

      <div className="department-card-footer">
        <span>
          {department.critical > 0
            ? `${department.critical} critical`
            : "No critical reports"}
        </span>

        <span>
          Pressure {pressure}
          <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

/* ============================================================
   DEPARTMENT DETAIL
============================================================ */

function DepartmentDetail({
  department,
  reports,
  open,
  onClose,
  onGoToReports,
}) {
  const departmentReports = reports.filter(
    (report) =>
      report.department === department.name
  );

  return (
    <Modal wide adminModal onClose={onClose}>
      <div className="department-detail-head">
        <div>
          <div className="report-ref">
            DEPARTMENT
          </div>

          <h2>{department.name}</h2>

          <p>
            Department operational performance
            and assigned report workload.
          </p>
        </div>

        <div className="department-detail-icon">
          <Building2 size={24} />
        </div>
      </div>

      <div className="department-detail-kpis">

        {/* WORKLOAD */}
        <div className="department-kpi-card department-kpi-total">
          <div className="department-kpi-icon">
            <ClipboardList size={18} />
          </div>

          <div className="department-kpi-content">
            <span>Total assigned</span>
            <strong>{department.total}</strong>
            <small>Reports in department</small>
          </div>
        </div>

        <div className="department-kpi-card department-kpi-open">
          <div className="department-kpi-icon">
            <Clock3 size={18} />
          </div>

          <div className="department-kpi-content">
            <span>Open</span>
            <strong>{department.open}</strong>
            <small>Awaiting action</small>
          </div>
        </div>

        <div className="department-kpi-card department-kpi-progress">
          <div className="department-kpi-icon">
            <Activity size={18} />
          </div>

          <div className="department-kpi-content">
            <span>In progress</span>
            <strong>{department.inProgress}</strong>
            <small>Currently being handled</small>
          </div>
        </div>

        {/* OUTCOME */}
        <div className="department-kpi-card department-kpi-resolved">
          <div className="department-kpi-icon">
            <CheckCircle2 size={18} />
          </div>

          <div className="department-kpi-content">
            <span>Resolved</span>
            <strong>{department.resolved}</strong>
            <small>Completed reports</small>
          </div>
        </div>

        {/* PRIORITY */}
        <div className="department-kpi-card department-kpi-high">
          <div className="department-kpi-icon">
            <AlertTriangle size={18} />
          </div>

          <div className="department-kpi-content">
            <span>High priority</span>
            <strong>{department.high}</strong>
            <small>Requires attention</small>
          </div>
        </div>

        <div className="department-kpi-card department-kpi-critical">
          <div className="department-kpi-icon">
            <AlertOctagon size={18} />
          </div>

          <div className="department-kpi-content">
            <span>Critical</span>
            <strong>{department.critical}</strong>
            <small>Urgent intervention</small>
          </div>
        </div>

        {/* REJECTED */}
        <div className="department-kpi-card department-kpi-rejected">
          <div className="department-kpi-icon">
            <XCircle size={18} />
          </div>

          <div className="department-kpi-content">
            <span>Rejected</span>
            <strong>{department.rejected}</strong>
            <small>Reports not accepted</small>
          </div>
        </div>

      </div>

      <div className="department-detail-section">
        <div className="detail-section-header">
          <div>
            <h3>Assigned reports</h3>

            <span>
              {departmentReports.length}{" "}
              {departmentReports.length === 1
                ? "report"
                : "reports"}
            </span>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => {
              onClose();
              onGoToReports();
            }}
          >
            <ClipboardList size={16} />
            Reports queue
          </button>
        </div>

        <div className="department-report-list">
          {departmentReports.map((report) => (
            <button
              type="button"
              className="department-report-row"
              key={report.reference}
              onClick={() => open(report.reference)}
            >
              <div>
                <strong>
                  {report.reference}
                </strong>

                <span>
                  {report.title}
                </span>
              </div>

              <div className="department-report-meta">
                <PriorityBadge
                  priority={report.priority}
                />

                <StatusBadge
                  status={report.status}
                />

                <ChevronRight size={16} />
              </div>
            </button>
          ))}

          {departmentReports.length === 0 && (
            <div className="loading">
              No reports assigned to this department.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   ANALYTICS COMPONENTS
============================================================ */

function AnalyticsMetric({
  icon,
  label,
  value,
  detail,
  danger = false,
}) {
  return (
    <div
      className={`analytics-metric ${
        danger ? "danger" : ""
      }`}
    >
      <div className="analytics-metric-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function AnalyticsCardHeader({
  title,
  subtitle,
}) {
  return (
    <div className="analytics-card-header">
      <div>
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <label className="analytics-filter">
      <span>{label}</span>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      >
        {options.map((option) => (
          <option key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function DepartmentBars({ reports }) {
  const departments = buildDepartmentData(
    reports
  ).slice(0, 8);

  if (!departments.length) {
    return (
      <div className="analytics-empty">
        No departmental data available.
      </div>
    );
  }

  const max = Math.max(
    ...departments.map((d) => d.total),
    1
  );

  return (
    <div className="department-bars">
      {departments.map((department) => (
        <div
          className="department-bar-row"
          key={department.name}
        >
          <div className="department-bar-name">
            <span>{department.name}</span>
            <strong>{department.total}</strong>
          </div>

          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${
                  (department.total / max) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryRanking({ reports }) {
  const categories = useMemo(() => {
    const map = {};

    reports.forEach((report) => {
      const category =
        report.category || "Uncategorised";

      map[category] =
        (map[category] || 0) + 1;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);
  }, [reports]);

  if (!categories.length) {
    return (
      <div className="analytics-empty">
        No category data available.
      </div>
    );
  }

  return (
    <div className="category-ranking">
      {categories.map(
        ([category, count], index) => (
          <div
            className="category-row"
            key={category}
          >
            <span className="category-rank">
              {String(index + 1).padStart(2, "0")}
            </span>

            <div className="category-name">
              <strong>{category}</strong>

              <div className="category-track">
                <div
                  style={{
                    width: `${
                      (count /
                        categories[0][1]) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>

            <strong>{count}</strong>
          </div>
        )
      )}
    </div>
  );
}

function RecentActivity({ reports }) {
  const recent = [...reports]
    .filter((r) => r.updatedAt)
    .sort(
      (a, b) =>
        new Date(b.updatedAt) -
        new Date(a.updatedAt)
    )
    .slice(0, 8);

  if (!recent.length) {
    return (
      <div className="analytics-empty">
        No recent activity available.
      </div>
    );
  }

  return (
    <div className="recent-activity">
      {recent.map((report) => (
        <div
          className="recent-activity-row"
          key={report.reference}
        >
          <div className="activity-dot">
            <Activity size={14} />
          </div>

          <div className="activity-main">
            <strong>{report.reference}</strong>

            <span>
              {report.title || "Report updated"}
            </span>
          </div>

          <div className="activity-status">
            <StatusBadge
              status={report.status}
            />

            <small>
              {formatDate(report.updatedAt)}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   SHARED UI
============================================================ */

function Kpi({
  icon,
  label,
  value,
  variant = "",
}) {
  return (
    <div className={`admin-kpi ${variant}`}>
      <span>{icon}</span>

      <div>
        <strong>{value ?? "—"}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const value = priority || "Medium";

  return (
    <span
      className={`priority priority-${slug(
        value
      )}`}
    >
      {value}
    </span>
  );
}

/* ============================================================
   DATA / ANALYTICS HELPERS
============================================================ */

function buildAnalytics(reports = []) {
  const status = {};
  const priority = {};
  const category = {};
  const department = {};

  STATUSES.forEach((value) => {
    status[value] = 0;
  });

  PRIORITIES.forEach((value) => {
    priority[value] = 0;
  });

  reports.forEach((report) => {
    const reportStatus =
      report.status || "Submitted";

    const reportPriority =
      report.priority || "Medium";

    const reportCategory =
      report.category || "Uncategorised";

    const reportDepartment =
      report.department || "Unassigned";

    status[reportStatus] =
      (status[reportStatus] || 0) + 1;

    priority[reportPriority] =
      (priority[reportPriority] || 0) + 1;

    category[reportCategory] =
      (category[reportCategory] || 0) + 1;

    department[reportDepartment] =
      (department[reportDepartment] || 0) + 1;
  });

  const resolved =
    status["Resolved"] || 0;

  const rejected =
    status["Rejected"] || 0;

  const active =
    reports.length -
    resolved -
    rejected;

  const resolutionRate =
    reports.length > 0
      ? Math.round(
          (resolved / reports.length) * 100
        )
      : 0;

  const critical =
    priority["Critical"] || 0;

  const high =
    priority["High"] || 0;

  return {
    total: reports.length,
    resolved,
    rejected,
    active,
    resolutionRate,
    critical,
    high,
    status,
    priority,
    category,
    department,
  };
}

function buildDepartmentData(reports = []) {
  const map = {};

  // Always create known departments so that departments
  // with zero reports are still visible.
  DEFAULT_DEPARTMENTS.forEach((name) => {
    map[name] = createDepartmentRecord(name);
  });

  reports.forEach((report) => {
    const name = report.department?.trim();

    // Do NOT create an "Unassigned" department.
    // Unassigned reports are displayed separately.
    if (!name) {
      return;
    }

    if (!map[name]) {
      map[name] = createDepartmentRecord(name);
    }

    const department = map[name];

    department.total += 1;

    switch (report.status) {
      case "Resolved":
        department.resolved += 1;
        break;

      case "Rejected":
        department.rejected += 1;
        break;

      case "Assigned":
        department.assigned += 1;
        break;

      case "In Progress":
        department.inProgress += 1;
        break;

      default:
        department.open += 1;
        break;
    }

    if (report.priority === "Critical") {
      department.critical += 1;
    }

    if (report.priority === "High") {
      department.high += 1;
    }
  });

  return Object.values(map).sort(
    (a, b) => {
      // Departments with active workload first
      if (b.open !== a.open) {
        return b.open - a.open;
      }

      return a.name.localeCompare(b.name);
    }
  );
}

function createDepartmentRecord(name) {
  return {
    name,
    total: 0,
    open: 0,
    assigned: 0,
    resolved: 0,
    rejected: 0,
    critical: 0,
    high: 0,
    inProgress: 0,
  };
}

function getDepartmentMetrics(department) {
  const total = department.total || 0;

  const resolutionRate =
    total > 0
      ? Math.round(
          (department.resolved / total) * 100
        )
      : 0;

  const rejectionRate =
    total > 0
      ? Math.round(
          (department.rejected / total) * 100
        )
      : 0;

  const pressure =
    department.critical * 4 +
    department.high * 2 +
    department.open;

  let health = "Stable";

  if (pressure >= 10) {
    health = "Critical";
  } else if (pressure >= 5) {
    health = "Attention";
  }

  return {
    resolutionRate,
    rejectionRate,
    pressure,
    health,
  };
}

function countStatus(reports, statuses) {
  return reports.filter((report) =>
    statuses.includes(report.status)
  ).length;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(
    (a, b) => a.localeCompare(b)
  );
}

function slug(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

const getAvailableStatusTransitions = (currentStatus) => {
  switch (currentStatus) {
    case "Submitted":
      return ["Under Review"];

    case "Under Review":
      return ["Assigned"];

    case "Assigned":
      return ["In Progress"];

    case "In Progress":
      return ["Resolved"];

    case "Resolved":
    case "Rejected":
      return [];

    default:
      return [];
  }
};

function getStatusTransitionError(
  currentStatus,
  nextStatus
) {
  if (
    currentStatus === "Resolved" ||
    currentStatus === "Rejected"
  ) {
    return `A ${currentStatus.toLowerCase()} report cannot be moved to another status.`;
  }

  const allowed =
    getAvailableStatusTransitions(currentStatus);

  if (!allowed.includes(nextStatus)) {
    return `Invalid workflow transition: ${currentStatus} → ${nextStatus}.`;
  }

  return null;
}

function hasCompleteRouting({
  department,
  assignedUnit,
}) {
  return Boolean(
    department?.trim() &&
    assignedUnit?.trim()
  );
}

/* ============================================================
   ADMIN MODAL
============================================================ */

function AdminModal({
  report,
  onClose,
  onStatus,
  onAssign,
}) {
  const [message, setMessage] = useState("");

  const [department, setDepartment] = useState(
    report.department || ""
  );

  const [unit, setUnit] = useState(
    report.assignedUnit || ""
  );

  const [priority, setPriority] = useState(
    report.priority || "Medium"
  );

  const [saving, setSaving] = useState(false);

  const currentStatus =
    report.status || "Submitted";

  /*
   * Only statuses that can actually be reached from
   * the current status are displayed.
   *
   * Rejected is handled separately because it is
   * available from every active workflow stage.
   */
  const availableStatuses =
    getAvailableStatusTransitions(
      currentStatus
    );

  const routingComplete =
    hasCompleteRouting({
      department,
      assignedUnit: unit,
    });

  /*
   * Routing becomes mandatory when the report is
   * about to enter Assigned status.
   */
  const assigning =
    availableStatuses.includes("Assigned");

  /*
   * ------------------------------------------------------------
   * SAVE ROUTING
   * ------------------------------------------------------------
   */

  async function saveAssignment(e) {
    e.preventDefault();

    if (
      currentStatus === "Rejected" ||
      currentStatus === "Resolved"
    ) {
      return;
    }

    if (!routingComplete) {
      window.alert(
        "Complete Routing before saving. Department and Assigned Unit are required."
      );

      return;
    }

    try {
      setSaving(true);

      await onAssign({
        department,
        assignedUnit: unit,
        priority,
      });
    } finally {
      setSaving(false);
    }
  }

  /*
   * ------------------------------------------------------------
   * STATUS VALIDATION
   * ------------------------------------------------------------
   */

  async function changeStatus(status, message) {
    if (!selected?.reference) return;

    if (!message?.trim()) {
      window.alert(
        "A public update is required before changing the report status."
      );
      return;
    }

    const currentStatus =
      selected.status || "Submitted";

    const transitionError =
      getStatusTransitionError(
        currentStatus,
        status
      );

    if (transitionError) {
      window.alert(transitionError);
      return;
    }

    // Assigned requires completed routing.
    if (status === "Assigned") {
      const routingComplete =
        hasCompleteRouting({
          department: selected.department,
          assignedUnit: selected.assignedUnit,
        });

      if (!routingComplete) {
        window.alert(
          "Routing is required before this report can be assigned. Please select a department and enter the assigned unit."
        );
        return;
      }
    }

    try {
      setBusy(true);

      const updated =
        await api.updateStatus(
          selected.reference,
          {
            status,
            message: message.trim(),
            isPublic: true,
          }
        );

      setSelected(updated);

      await load();

    } catch (error) {
      console.error(
        "Failed to update status:",
        error
      );

      window.alert(
        error?.message ||
          "Unable to update report status."
      );

    } finally {
      setBusy(false);
    }
  }

  function canChangeStatus(
    current,
    next
  ) {
    if (!next || next === current) {
      return false;
    }

    /*
     * Rejection is allowed from every active stage.
     */
    if (next === "Rejected") {
      return (
        current !== "Rejected" &&
        current !== "Resolved" &&
        current !== "In Progres"
      );
    }

    return (
      STATUS_TRANSITIONS[current] || []
    ).includes(next);
  }

  /*
   * ------------------------------------------------------------
   * STATUS CHANGE
   * ------------------------------------------------------------
   */

  async function handleStatusChange(nextStatus) {
    if (
      !nextStatus ||
      nextStatus === currentStatus
    ) {
      return;
    }

    /*
    * Prevent invalid workflow transitions.
    */
    if (
      !canChangeStatus(
        currentStatus,
        nextStatus
      )
    ) {
      return;
    }

    /*
    * Use the central transition validator
    * for user-facing error messages.
    */
    const transitionError =
      getStatusTransitionError(
        currentStatus,
        nextStatus
      );

    if (transitionError) {
      window.alert(transitionError);
      return;
    }

    /*
    * PUBLIC UPDATE IS REQUIRED
    * FOR EVERY STATUS CHANGE.
    */
    if (!message?.trim()) {
      window.alert(
        "A public update is required before changing the report status."
      );

      return;
    }

    /*
    * ASSIGNED requires complete routing.
    */
    if (
      nextStatus === "Assigned" &&
      !routingComplete
    ) {
      window.alert(
        "Complete Routing before assigning this report. Department and Assigned Unit are required."
      );

      return;
    }

    await onStatus(
      nextStatus,
      message.trim()
    );

    setMessage("");
  }

  return (
    <Modal
      wide
      adminModal
      onClose={onClose}
    >
      <div className="admin-detail-head">
        <div>
          <div className="report-ref">
            {report.reference}
          </div>

          <h2>{report.title}</h2>

          <p>
            {report.locationLabel}
          </p>
        </div>

        <StatusBadge
          status={currentStatus}
        />
      </div>

      <div className="admin-detail-grid">

        {/* ======================================================
            REPORT DETAILS
        ====================================================== */}

        <div className="admin-detail-main">

          {report.photoUrl && (
            <img
              className="detail-photo"
              src={report.photoUrl}
              alt="Civic report evidence"
            />
          )}

          <div className="detail-description">
            {report.description}
          </div>

          <h3 className="subheading">
            Citizen-visible lifecycle
          </h3>

          <Timeline report={report} />

        </div>


        {/* ======================================================
            ADMIN CONTROLS
        ====================================================== */}

        <div className="admin-controls">

          {/* ====================================================
              ROUTING
          ==================================================== */}

          {currentStatus === "Under Review" && (
            <form
              onSubmit={saveAssignment}
              className="control-section"
            >

              <h2>
                <SlidersHorizontal size={17} />

                Routing

                {assigning && (
                  <span
                    style={{
                      color: "#dc2626",
                      fontSize: "11px",
                      marginLeft: "6px",
                    }}
                  >
                    REQUIRED
                  </span>
                )}
              </h2>

              {/* DEPARTMENT */}

              <label>
                Department

                <select
                  value={department}
                  onChange={(e) =>
                    setDepartment(e.target.value)
                  }
                >
                  <option value="">
                    Select department
                  </option>

                  {DEFAULT_DEPARTMENTS.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>


              {/* ASSIGNED UNIT */}

              <label>
                Assigned unit

                <input
                  value={unit}
                  onChange={(e) =>
                    setUnit(e.target.value)
                  }
                  placeholder="e.g. Road Maintenance Unit"
                />
              </label>


              {/* PRIORITY */}

              <label>
                Priority

                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value)
                  }
                >
                  {PRIORITIES.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </label>


              {/* ROUTING STATUS */}

              <div
                className={`admin-note ${
                  routingComplete
                    ? "routing-complete"
                    : "routing-incomplete"
                }`}
              >
                <strong>
                  {routingComplete
                    ? "Routing complete"
                    : "Routing incomplete"}
                </strong>

                <p>
                  {routingComplete
                    ? `${department} → ${unit}`
                    : "Department and assigned unit are required before the report can enter Assigned status."}
                </p>
              </div>


              {/* SAVE ROUTING */}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  saving ||
                  !routingComplete
                }
              >
                {saving
                  ? "Saving..."
                  : "Save routing"}
              </button>

            </form>
          )}

          {/* ====================================================
              STATUS CONTROL
          ==================================================== */}

          <div className="control-section">

            <h2>
              <SlidersHorizontal size={17} />
              Update Report
            </h2>


            {/* PUBLIC UPDATE */}

            <label>
              Public Note

              <textarea
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                rows="3"
                placeholder="What should citizens know?"
                disabled={
                  currentStatus === "Rejected" ||
                  currentStatus === "Resolved"
                }
              />
            </label>


            {/* STATUS */}

            <label>
              Status

              <select
                value=""
                onChange={(e) =>
                  handleStatusChange(e.target.value)
                }
                disabled={
                  currentStatus === "Resolved" ||
                  currentStatus === "Rejected"
                }
              >
                <option value="">
                  {currentStatus === "Resolved" ||
                  currentStatus === "Rejected"
                    ? "No further transition"
                    : "Select next status"}
                </option>

                {availableStatuses.map((status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                ))}
              </select>
            </label>


            {/* ==================================================
                REJECTION CUTOFF
            ================================================== */}

            {currentStatus === "Assigned" && (
              <div
                style={{
                  marginTop: "8px",
                  color: "#dc2626",
                  fontSize: "12px",
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                ⚠ Report cannot be rejected after this stage.
              </div>
            )}


            {/* ==================================================
                REJECTION
            ================================================== */}

            {["Submitted", "Under Review", "Assigned"].includes(
              currentStatus
            ) && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  handleStatusChange("Rejected")
                }
              >
                <XCircle size={16} />
                Reject Report
              </button>
            )}

            {/* ==================================================
                REJECTED STATE
            ================================================== */}

            {currentStatus === "Rejected" && (
              <div className="admin-note">
                <strong>
                  Report rejected
                </strong>

                <p>
                  This report is closed and
                  cannot be resubmitted or
                  returned to the workflow.
                </p>
              </div>
            )}


            {/* ==================================================
                RESOLVED STATE
            ================================================== */}

            {currentStatus === "Resolved" && (
              <div className="admin-note">
                <strong>
                  Report Resolved
                </strong>

                <p>
                  This report has completed
                  the operational lifecycle.
                </p>
              </div>
            )}

          </div>

          {/* ====================================================
              LIFECYCLE RULE
          ==================================================== */}

          <div className="admin-note">
            <strong>
              Workflow Control
            </strong>

            <p>
              • Reports progress through Submitted → Under Review → Assigned → In Progress → Resolved.<br />
              • Routing is required before entering Assigned status.<br />
              • Reports may be rejected from Submitted through Assigned only.<br />
              • Once a report enters In Progress, rejection is no longer permitted.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
