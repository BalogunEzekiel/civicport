import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  MapContainer,
  Marker,
  Popup,
  TileLayer
} from "react-leaflet";

import L from "leaflet";

import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Filter,
  Map,
  Search,
  ShieldCheck,
  Siren,
  TrendingUp
} from "lucide-react";

import Logo from "../components/Logo";
import ReportCard from "../components/ReportCard";
import IssueMap from "../components/IssueMap";
import Modal from "../components/Modal";
import Timeline from "../components/Timeline";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";

const userLocationIcon = L.divIcon({
  className: "civicport-user-location",
  html: `
    <div class="civicport-location-pulse">
      <div class="civicport-location-dot"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const categories = [
  "All",
  "Roads",
  "Streetlights",
  "Waste",
  "Flooding",
  "Water",
  "Public Facilities"
];

const LOCATION_MAX_ACCURACY = 100;

const LOCATION_FIELDS = [
  {
    key: "streetName",
    label: "Street name",
    placeholder: "Enter the street or road name"
  },
  {
    key: "neighbourhood",
    label: "Neighbourhood",
    placeholder: "Enter your neighbourhood"
  },
  {
    key: "city",
    label: "City",
    placeholder: "Enter your city"
  },
  {
    key: "state",
    label: "State",
    placeholder: "Enter your state"
  },
  {
    key: "country",
    label: "Country",
    placeholder: "Enter your country"
  }
];

function getMissingLocationFields(form) {
  return LOCATION_FIELDS
    .map(field => field.key)
    .filter(field => !String(form[field] || "").trim());
}

export default function PublicDashboard() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1
  });

  async function load(nextPage = page) {
    const [s, r] = await Promise.all([
      api.stats(),
      api.reports({
        q: query,
        category,
        status,
        page: nextPage,
        pageSize
      })
    ]);

    setStats(s);
    setReports(Array.isArray(r?.items) ? r.items : []);
    setPagination(
      r?.pagination || {
        page: nextPage,
        pageSize,
        total: r?.items?.length || 0,
        totalPages: 1
      }
    );
  }

  useEffect(() => {
    setPage(1);
    load(1);
  }, [category, status]);

  const filtered = useMemo(() => reports, [reports]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  async function openReport(reference) {
    setSelected(await api.report(reference));
  }

  return (
    <div className="app-shell">
      <div
        className="emergency-ticker"
        role="note"
        aria-label="Emergency response notice"
      >
        <div className="emergency-ticker-track">
          <span>
            ⚠️ CivicPort is not an emergency response unit — it is a civic
            reporting innovation. For emergencies requiring immediate response,
            call <strong>112</strong>.
          </span>

          <span aria-hidden="true">
            ⚠️ CivicPort is not an emergency response unit — it is a civic
            reporting innovation. For emergencies requiring immediate response,
            call <strong>112</strong>.
          </span>
        </div>
      </div>

      <header className="topbar">
        <Logo />

        <nav className="public-nav">
          <a href="#issues" className="nav-explore">
            <Search size={16} />
            <span>Explore Issues</span>
          </a>

          <Link to="/government-login">
            Government Portal
          </Link>

          {/*
          <a href="/admin" className="nav-government">
            <ShieldCheck size={16} />
            <span>Government Portal</span>
          </a>
          */}
        </nav>

        <button
          className="btn btn-primary topbar-report"
          onClick={() => setShowReport(true)}
        >
          <Siren size={17} />
          <span>Report An Issue</span>
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span></span> AI-POWERED CIVIC INTELLIGENCE
            </div>

            <h1>
              From community voice to <em>intelligent civic action.</em>
            </h1>

            <p>
              Report civic issues with evidence and location, then follow a
              transparent lifecycle from submission to resolution — powered by
              AI-assisted triage, operational intelligence and human-led
              decisions.
            </p>

            <div className="hero-ai-badge">
              <Bot size={15} />
              AI-powered civic intelligence · Human oversight by design
            </div>

            <div className="hero-actions">
              <button
                className="btn btn-primary btn-large"
                onClick={() => setShowReport(true)}
              >
                Report An Issue <ArrowRight size={18} />
              </button>

              <button
                className="btn btn-ghost btn-large"
                onClick={() =>
                  document
                    .getElementById("issues")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Explore reports
              </button>
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-top">
              <span>LIVE COMMUNITY PULSE</span>
              <span className="live">
                <i /> LIVE
              </span>
            </div>

            <div className="pulse-number">
              {stats?.total ?? "—"}
            </div>

            <p>civic reports submitted</p>

            <div className="pulse-grid">
              <div>
                <strong>{stats?.open ?? "—"}</strong>
                <span>Open</span>
              </div>

              <div>
                <strong>{stats?.progress ?? "—"}</strong>
                <span>In progress</span>
              </div>

              <div>
                <strong>{stats?.resolved ?? "—"}</strong>
                <span>Resolved</span>
              </div>

              <div>
                <strong>{stats?.rejected ?? "—"}</strong>
                <span>Rejected</span>
              </div>
            </div>
          </div>
        </section>

        <section className="ai-innovation-section">
          <div className="ai-innovation-glow" />

          <div>
            <div className="eyebrow">
              <span></span> THE CIVICPORT AI DIFFERENCE
            </div>

            <h2>
              Intelligence that helps communities move from{" "}
              <em>reporting</em> to <em>response.</em>
            </h2>

            <p>
              CivicPort combines evidence-aware AI, lifecycle intelligence and
              transparent workflows to help civic teams understand what is
              happening, focus attention where it matters, coordinate action
              and communicate progress — while keeping consequential decisions
              in human hands.
            </p>
          </div>

          <div className="ai-capability-grid">
            <div>
              <Bot />
              <strong>AI Triage</strong>
              <span>
                Turns incoming reports into structured, actionable
                intelligence.
              </span>
            </div>

            <div>
              <Activity />
              <strong>Lifecycle Intelligence</strong>
              <span>
                Understands where every issue is in its journey and what comes
                next.
              </span>
            </div>

            <div>
              <ShieldCheck />
              <strong>Human Governance</strong>
              <span>
                AI advises; authorized people make consequential decisions.
              </span>
            </div>

            <div>
              <TrendingUp />
              <strong>Operations Insight</strong>
              <span>
                Surfaces patterns, workload signals and evidence for better
                coordination.
              </span>
            </div>
          </div>
        </section>

        <section className="impact-strip">
          <div>
            <ShieldCheck />
            <div>
              <strong>Evidence-first</strong>
              <span>Photo + location for every report</span>
            </div>
          </div>

          <div>
            <Activity />
            <div>
              <strong>Trackable</strong>
              <span>Every status change is recorded</span>
            </div>
          </div>

          <div>
            <CheckCircle2 />
            <div>
              <strong>Accountable</strong>
              <span>Public updates show what happened</span>
            </div>
          </div>
        </section>

        <section id="issues" className="content-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">COMMUNITY REPORTS</div>
              <h2>See what needs attention.</h2>
            </div>

            <button
              className="btn btn-outline"
              onClick={() => setShowMap(!showMap)}
            >
              <Map size={17} />
              {showMap ? "List view" : "Map view"}
            </button>
          </div>

          <div className="filters">
            <label className="search">
              <Search size={17} />

              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e =>
                  e.key === "Enter" && load()
                }
                placeholder="Search reports, locations or reference..."
              />
            </label>

            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {categories.map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {[
                "All",
                "Submitted",
                "Under Review",
                "Assigned",
                "In Progress",
                "Resolved",
                "Rejected"
              ].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>

            <button className="btn btn-outline filter-button">
              <Filter size={16} />
              Filters
            </button>
          </div>

          {showMap ? (
            <IssueMap
              reports={filtered}
              onOpen={openReport}
            />
          ) : (
            <div className="report-grid">
              {filtered.map(r => (
                <ReportCard
                  key={r.reference}
                  report={r}
                  onOpen={openReport}
                />
              ))}
            </div>
          )}

          {!filtered.length && (
            <div className="empty">
              No reports match your filters.
            </div>
          )}

          {!showMap && pagination.total > 0 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onChange={next => {
                setPage(next);
                load(next);

                window.scrollTo({
                  top:
                    document.getElementById("issues")?.offsetTop || 0,
                  behavior: "smooth"
                });
              }}
            />
          )}
        </section>
      </main>

      <footer>
        <Logo />
        <span>© 2026 CivicPort · Report. Track. Resolve.</span>
      </footer>

      {showReport && (
        <ReportForm
          onClose={() => setShowReport(false)}
          onCreated={async r => {
            setShowReport(false);
            await load();
            setSelected(r);
          }}
        />
      )}

      {selected && (
        <Modal
          wide
          onClose={() => setSelected(null)}
        >
          <div className="modal-header">
            <div>
              <div className="report-ref">
                {selected.reference}
              </div>

              <h2>{selected.title}</h2>
              <p>{selected.locationLabel}</p>
            </div>

            <StatusBadge status={selected.status} />
          </div>

          {selected.photoUrl && (
            <img
              className="detail-photo"
              src={selected.photoUrl}
              alt={selected.title}
            />
          )}

          <p className="detail-description">
            {selected.description}
          </p>

          <div className="detail-grid">
            <div>
              <span>Category</span>
              <strong>{selected.category}</strong>
            </div>

            <div>
              <span>Priority</span>
              <strong>{selected.priority}</strong>
            </div>

            <div>
              <span>Department</span>
              <strong>
                {selected.department || "Pending assignment"}
              </strong>
            </div>
          </div>

          <h3 className="subheading">Progress</h3>

          <Timeline report={selected} />

          <div className="updates">
            {(selected.updates || [])
              .filter(u => u.isPublic)
              .map(u =>
                u.photoUrl ? (
                  <img
                    key={u.id}
                    src={u.photoUrl}
                    className="update-photo"
                    alt="Progress update"
                  />
                ) : null
              )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange
}) {
  if (!total || totalPages <= 1) return null;

  const pages = [];

  const add = n => {
    if (
      n >= 1 &&
      n <= totalPages &&
      !pages.includes(n)
    ) {
      pages.push(n);
    }
  };

  add(1);

  for (
    let n = Math.max(2, page - 1);
    n <= Math.min(totalPages - 1, page + 1);
    n += 1
  ) {
    add(n);
  }

  add(totalPages);

  const visible = [];

  pages.forEach((n, i) => {
    if (
      i > 0 &&
      n - pages[i - 1] > 1
    ) {
      visible.push("ellipsis-" + n);
    }

    visible.push(n);
  });

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className="pagination"
      aria-label="Reports pagination"
    >
      <span className="pagination-summary">
        {start}-{end} of {total}
      </span>

      <div className="pagination-controls">
        <button
          className="pagination-arrow"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>

        {visible.map(item =>
          item.startsWith("ellipsis") ? (
            <span
              key={item}
              className="pagination-ellipsis"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              className={
                item === page ? "active" : ""
              }
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          )
        )}

        <button
          className="pagination-arrow"
          disabled={page === totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function LocationPicker({
  latitude,
  longitude,
  accuracy,
  locationLabel
}) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  return (
    <div className="location-map-wrapper">
      <MapContainer
        key={`${lat}-${lng}`}
        center={[lat, lng]}
        zoom={17}
        scrollWheelZoom={true}
        style={{
          width: "100%",
          height: "240px"
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker
          position={[lat, lng]}
          icon={userLocationIcon}
        >
          <Popup>
            <strong>You are here</strong>
            <br />
            {locationLabel || "Location detected"}
            <br />
            <small>
              {Number.isFinite(Number(accuracy))
                ? `GPS accuracy: ±${Math.round(
                    Number(accuracy)
                  )}m`
                : "GPS accuracy unavailable"}
            </small>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

function ReportForm({
  onClose,
  onCreated
}) {
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    latitude: "",
    longitude: "",
    accuracy: "",
    locationLabel: "",
    streetName: "",
    neighbourhood: "",
    city: "",
    state: "",
    country: "",
    locationVerified: false,
    locationSource: ""
  });

  const [photo, setPhoto] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationResolved, setLocationResolved] = useState(false);
  const [locationAttempted, setLocationAttempted] = useState(false);
  const [locationInputFields, setLocationInputFields] = useState([]);
  const [locationMessage, setLocationMessage] = useState(
    "Your precise device location is required."
  );
  const [error, setError] = useState("");

  function resetLocation() {
    setForm(previous => ({
      ...previous,
      latitude: "",
      longitude: "",
      accuracy: "",
      locationLabel: "",
      streetName: "",
      neighbourhood: "",
      city: "",
      state: "",
      country: "",
      locationVerified: false,
      locationSource: ""
    }));

    setLocationResolved(false);
    setLocationInputFields([]);

    setLocationMessage(
      "Your precise device location is required."
    );
  }

  async function verifyLocation(
    latitude,
    longitude,
    accuracy
  ) {
    const apiBase =
      `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

    const url = new URL(
      `${apiBase}/geocode/reverse`
    );

    url.searchParams.set(
      "lat",
      String(latitude)
    );

    url.searchParams.set(
      "lon",
      String(longitude)
    );

    url.searchParams.set(
      "accuracy",
      String(accuracy)
    );

    const response = await fetch(
      url.toString(),
      {
        credentials: "include"
      }
    );

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    /*
     * A successful reverse-geocoding request can still be partial.
     * The server returns missingFields when one or more required
     * human-readable location fields could not be resolved.
     */
    if (!response.ok) {
      throw new Error(
        data.error ||
        "CivicPort could not verify this location right now."
      );
    }

    return data;
  }

  function updateLocationField(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value,
      locationVerified: false
    }));

    setLocationMessage(
      "Complete the missing location details, then click Submit. CivicPort will verify the final location before creating the report."
    );
  }

  async function locate() {
    if (!navigator.geolocation) {
      setError(
        "This browser does not support precise location detection. Please use a modern browser with location services enabled."
      );
      return;
    }

    if (!window.isSecureContext) {
      setError(
        "Precise location requires a secure connection (HTTPS). Please open CivicPort over HTTPS."
      );
      return;
    }

    setLocating(true);
    setLocationAttempted(true);
    setError("");
    resetLocation();

    setLocationMessage(
      "Acquiring a high-accuracy GPS fix…"
    );

    /*
     * Use watchPosition rather than a single GPS reading.
     * Mobile devices often improve accuracy over several seconds.
     * We keep the best reading observed during the short capture
     * window, then independently reverse-geocode it on the server.
     */
    let watchId = null;
    let best = null;
    let settled = false;
    let timer = null;

    const finish = async () => {
      if (settled) return;

      settled = true;

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      if (watchId !== null) {
        navigator.geolocation.clearWatch(
          watchId
        );
      }

      if (!best) {
        setLocating(false);

        setError(
          "CivicPort could not obtain a reliable GPS position. Please enable precise location and try again."
        );
        return;
      }

      if (
        !Number.isFinite(best.accuracy) ||
        best.accuracy <= 0 ||
        best.accuracy > LOCATION_MAX_ACCURACY
      ) {
        setLocating(false);
        setLocationResolved(false);

        resetLocation();

        setError(
          `GPS accuracy is currently about ${Math.round(
            best.accuracy
          )}m. CivicPort requires ${LOCATION_MAX_ACCURACY}m or better so the report can be tied to the correct location. Please try again.`
        );

        return;
      }

      setLocationMessage(
        "GPS fix acquired. Resolving the location details…"
      );

      try {
        const geocoded =
          await verifyLocation(
            best.latitude,
            best.longitude,
            best.accuracy
          );

        const missingFields =
          Array.isArray(
            geocoded.missingFields
          )
            ? geocoded.missingFields
            : getMissingLocationFields(
                geocoded
              );

        setLocationInputFields(missingFields);

        setForm(previous => ({
          ...previous,
          latitude:
            geocoded.latitude ??
            best.latitude,
          longitude:
            geocoded.longitude ??
            best.longitude,
          accuracy: best.accuracy,
          locationLabel:
            geocoded.locationLabel || "",
          streetName:
            geocoded.streetName || "",
          neighbourhood:
            geocoded.neighbourhood || "",
          city:
            geocoded.city || "",
          state:
            geocoded.state || "",
          country:
            geocoded.country || "",
          locationVerified: false,
          locationSource:
            geocoded.locationSource ||
            "gps+reverse-geocoding",
        }));

        setLocationResolved(true);

        if (missingFields.length > 0) {
          setLocationMessage(
            `GPS location captured. Please provide the ${
              missingFields.length === 1
                ? "missing location detail"
                : "missing location details"
            } below.`
          );
        } else {
          setLocationMessage(
            "Location verified from your physical GPS coordinates."
          );
        }

        setLocating(false);
      } catch (verificationError) {
        console.error(
          "CivicPort location verification failed:",
          verificationError
        );

        setLocating(false);

        setError(
          verificationError.message ||
          "CivicPort could not reliably identify the location at your current position."
        );

        setLocationMessage(
          "GPS detected, but the location could not be resolved."
        );
      }
    };

    timer = window.setTimeout(
      finish,
      15000
    );

    watchId =
      navigator.geolocation.watchPosition(
        position => {
          const {
            latitude,
            longitude,
            accuracy
          } = position.coords;

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(accuracy)
          ) {
            return;
          }

          if (
            !best ||
            accuracy < best.accuracy
          ) {
            best = {
              latitude,
              longitude,
              accuracy
            };

            setLocationMessage(
              `GPS accuracy: ±${Math.round(
                accuracy
              )}m. Improving the location fix…`
            );
          }

          /*
           * Stop early once a genuinely strong GPS fix
           * is available, reducing waiting time for good devices.
           */
          if (accuracy <= 30) {
            window.clearTimeout(timer);
            timer = null;
            finish();
          }
        },
        gpsError => {
          console.error(
            "CivicPort GPS error:",
            gpsError
          );

          if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }

          if (watchId !== null) {
            navigator.geolocation.clearWatch(
              watchId
            );
          }

          settled = true;
          setLocating(false);

          if (gpsError.code === 1) {
            setError(
              "Location permission was denied. Please allow precise location access in your browser/device settings and try again."
            );
          } else if (gpsError.code === 2) {
            setError(
              "Your device could not determine its location. Turn on GPS/location services and try again."
            );
          } else if (gpsError.code === 3) {
            setError(
              "Location detection timed out. Please try again."
            );
          } else {
            setError(
              "Unable to determine your location. Please try again."
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError(
        "Please enter an issue title."
      );
      return;
    }

    if (!form.category) {
      setError(
        "Please select an issue category."
      );
      return;
    }

    if (!form.description.trim()) {
      setError(
        "Please describe the civic issue."
      );
      return;
    }

    if (!photo) {
      setError(
        "Please attach a photo showing the civic issue before submitting."
      );
      return;
    }

    if (locating) {
      setError(
        "Please wait while CivicPort finishes verifying the location."
      );
      return;
    }

    const missingLocationFields =
      getMissingLocationFields(form);

    const parsedAccuracy = Number(form.accuracy);

    if (
      !Number.isFinite(Number(form.latitude)) ||
      !Number.isFinite(Number(form.longitude)) ||
      !Number.isFinite(parsedAccuracy) ||
      parsedAccuracy <= 0
    ) {
      setError(
        "A precise physical GPS location with a valid accuracy reading is required. Please use 'Detect my location' before submitting."
      );
      return;
    }

    if (parsedAccuracy > LOCATION_MAX_ACCURACY) {
      setError(
        `GPS accuracy must be ${LOCATION_MAX_ACCURACY}m or better. Please detect your location again.`
      );
      return;
    }

    if (missingLocationFields.length > 0) {
      setError(
        `Please complete the missing ${
          missingLocationFields.length === 1
            ? "location detail"
            : "location details"
        } before submitting.`
      );
      return;
    }

    setSaving(true);

    try {
      const fd = new FormData();

      fd.append(
        "title",
        form.title.trim()
      );

      fd.append(
        "category",
        form.category
      );

      fd.append(
        "description",
        form.description.trim()
      );

      fd.append(
        "latitude",
        String(form.latitude)
      );

      fd.append(
        "longitude",
        String(form.longitude)
      );

      fd.append(
        "accuracy",
        String(parsedAccuracy)
      );

      fd.append(
        "locationLabel",
        form.locationLabel || ""
      );

      fd.append(
        "streetName",
        form.streetName.trim()
      );

      fd.append(
        "neighbourhood",
        form.neighbourhood.trim()
      );

      fd.append(
        "city",
        form.city.trim()
      );

      fd.append(
        "state",
        form.state.trim()
      );

      fd.append(
        "country",
        form.country.trim()
      );

      fd.append(
        "photo",
        photo
      );

      const report =
        await api.createReport(fd);

      onCreated(report);
    } catch (submitError) {
      console.error(
        "Report submission failed:",
        submitError
      );

      /*
       * If the server discovers that a field is still missing
       * after its own reverse geocoding, surface those fields
       * back into the form instead of treating the response as
       * a generic failure.
       */
      if (
        Array.isArray(
          submitError?.missingFields
        ) &&
        submitError.missingFields.length > 0
      ) {
        setLocationInputFields(
          submitError.missingFields
        );

        setForm(previous => ({
          ...previous,
          locationVerified: false
        }));

        setLocationResolved(true);
      }

      setError(
        submitError.message ||
        "Unable to submit civic report."
      );
    } finally {
      setSaving(false);
    }
  }

  const hasCoordinates =
    Number.isFinite(
      Number(form.latitude)
    ) &&
    Number.isFinite(
      Number(form.longitude)
    );

  const missingLocationFields =
    getMissingLocationFields(form);

  const hasCompleteLocation =
    Boolean(
      form.streetName?.trim() &&
      form.neighbourhood?.trim() &&
      form.city?.trim() &&
      form.state?.trim() &&
      form.country?.trim() &&
      hasCoordinates &&
      Number.isFinite(
        Number(form.accuracy)
      ) &&
      Number(form.accuracy) > 0 &&
      Number(form.accuracy) <=
        LOCATION_MAX_ACCURACY
    );

  const hasVerifiedLocation =
    Boolean(
      form.locationVerified &&
      form.streetName?.trim() &&
      form.neighbourhood?.trim() &&
      form.city?.trim() &&
      form.state?.trim() &&
      form.country?.trim() &&
      hasCoordinates &&
      Number.isFinite(
        Number(form.accuracy)
      ) &&
      Number(form.accuracy) > 0 &&
      Number(form.accuracy) <=
        LOCATION_MAX_ACCURACY
    );

  const hasMissingLocationFields =
    locationResolved &&
    locationInputFields.length > 0;

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <div>
          <div className="eyebrow">
            NEW CIVIC REPORT
          </div>

          <h2>
            Make the issue visible.
          </h2>

          <p>
            Give the responsible team enough
            evidence to act.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="form"
      >
        <label>
          Issue title
          <input
            required
            value={form.title}
            onChange={e =>
              setForm(previous => ({
                ...previous,
                title: e.target.value
              }))
            }
            placeholder="e.g. Large pothole on Ikeja road"
          />
        </label>

        <label>
          Category{" "}
          <span className="required-field">
            *
          </span>

          <select
            required
            value={form.category}
            onChange={e =>
              setForm(previous => ({
                ...previous,
                category: e.target.value
              }))
            }
          >
            <option
              value=""
              disabled
            >
              Select a category
            </option>

            {categories
              .slice(1)
              .map(category => (
                <option
                  key={category}
                  value={category}
                >
                  {category}
                </option>
              ))}
          </select>

          <small>
            Select the category that best describes
            the issue.
          </small>
        </label>

        <label>
          Description

          <textarea
            required
            value={form.description}
            onChange={e =>
              setForm(previous => ({
                ...previous,
                description: e.target.value
              }))
            }
            placeholder="Describe what is happening and why it matters."
            rows="4"
          />
        </label>

        <label>
          Photo{" "}
          <span className="required-field">
            *
          </span>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={e =>
              setPhoto(
                e.target.files?.[0] ||
                null
              )
            }
          />

          <small>
            Take a picture as evidence. A clear photo
            is required as evidence for every report.
          </small>
        </label>

        <div className="location-box">
          <div className="location-header">
            <div>
              <strong>
                📍 Verified Report Location
              </strong>

              <span>
                {locating
                  ? locationMessage
                  : hasVerifiedLocation
                    ? form.locationLabel ||
                      "Location verified"
                    : locationResolved &&
                        hasMissingLocationFields
                      ? locationMessage
                      : "Not verified yet"}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={locate}
              disabled={
                locating ||
                saving
              }
            >
              {locating
                ? "Detecting…"
                : hasCoordinates
                  ? "Detect location"
                  : "Detect my location"}
            </button>
          </div>

          {locating && (
            <div
              className="location-detection-status"
              role="status"
              aria-live="polite"
            >
              <span className="location-spinner" />

              <div>
                <strong>
                  Establishing your location…
                </strong>

                <span>
                  Keep location services enabled and,
                  if possible, move where your device has
                  a clear view of the sky.
                </span>
              </div>
            </div>
          )}

          {locationResolved && hasCoordinates && (
            <>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                accuracy={form.accuracy}
                locationLabel={
                  form.locationLabel
                }
              />

              <div className="location-details">
                {LOCATION_FIELDS.map(
                  field => {
                    const value =
                      String(
                        form[field.key] ||
                          ""
                      ).trim();

                    if (
                      !value ||
                      locationInputFields.includes(field.key)
                    ) {
                      return null;
                    }

                    return (
                      <div
                        key={field.key}
                      >
                        <span>
                          {field.label}
                        </span>

                        <strong>
                          {value}
                        </strong>
                      </div>
                    );
                  }
                )}

                <div>
                  <span>
                    GPS accuracy
                  </span>

                  <strong>
                    {Number.isFinite(
                      Number(form.accuracy)
                    )
                      ? `±${Math.round(
                          Number(
                            form.accuracy
                          )
                        )}m`
                      : "Unavailable"}
                  </strong>
                </div>
              </div>

              {locationResolved &&
                !locating &&
                locationInputFields.length > 0 && (
                  <div className="location-missing-fields">
                    <div className="location-missing-header">
                      <strong>
                        Complete the missing location details
                      </strong>

                      <span>
                        CivicPort could not automatically resolve
                        these details from the physical GPS location.
                        Complete the fields below, then click Submit.
                        CivicPort will verify the final location before
                        creating the report.
                      </span>
                    </div>

                    {LOCATION_FIELDS
                      .filter(field =>
                        locationInputFields.includes(field.key)
                      )
                      .map(field => (
                        <label key={field.key}>
                          {field.label}{" "}
                          <span className="required-field">
                            *
                          </span>

                          <input
                            value={form[field.key] || ""}
                            onChange={e =>
                              updateLocationField(
                                field.key,
                                e.target.value
                              )
                            }
                            placeholder={field.placeholder}
                            required
                          />
                        </label>
                      ))}
                  </div>
                )}

              {hasVerifiedLocation && (
                <div
                  className="location-confirmation"
                  role="status"
                >
                  <span>✓</span>

                  <div>
                    <strong>
                      Location verified
                    </strong>

                    <small>
                      {locationMessage}
                    </small>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div
            className="form-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-large"
          disabled={
            saving ||
            locating ||
            !hasCompleteLocation
          }
        >
          {saving
            ? "Verifying & submitting…"
            : hasCompleteLocation
              ? "Verify & submit report"
              : hasMissingLocationFields
                ? "Complete location details"
                : "Verify location to continue"}

          <ArrowRight size={18} />
        </button>
      </form>
    </Modal>
  );
}