import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CheckCircle2, Filter, Map, Search, ShieldCheck, Siren } from "lucide-react";
import Logo from "../components/Logo";
import ReportCard from "../components/ReportCard";
import IssueMap from "../components/IssueMap";
import Modal from "../components/Modal";
import Timeline from "../components/Timeline";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";
import L from "leaflet";

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

const categories = ["All", "Roads", "Streetlights", "Waste", "Flooding", "Water", "Public Facilities"];

export default function PublicDashboard() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showMap, setShowMap] = useState(false);

  async function load() {
    const [s, r] = await Promise.all([api.stats(), api.reports({ q: query, category, status })]);
    setStats(s); setReports(r);
  }
  useEffect(() => { load(); }, [category, status]);

  const filtered = useMemo(() => query ? reports : reports, [reports, query]);

  async function openReport(reference) {
    setSelected(await api.report(reference));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Logo />

        <nav className="public-nav">
          <a href="#issues" className="nav-explore">
            <Search size={16} />
            <span>Explore Issues</span>
          </a>

          <a href="/admin" className="nav-government">
            <ShieldCheck size={16} />
            <span>Government Portal</span>
          </a>
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
            <div className="eyebrow"><span></span> CIVIC TRANSPARENCY PLATFORM</div>
            <h1>Turn a local problem into <em>visible action.</em></h1>
            <p>Report civic issues with evidence and location. Follow the response from first submission to final resolution.</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-large" onClick={() => setShowReport(true)}>Report An Issue <ArrowRight size={18}/></button>
              <button className="btn btn-ghost btn-large" onClick={() => document.getElementById("issues")?.scrollIntoView({ behavior: "smooth" })}>Explore reports</button>
            </div>
          </div>
          <div className="hero-panel">
            <div className="panel-top"><span>LIVE COMMUNITY PULSE</span><span className="live"><i/> LIVE</span></div>
            <div className="pulse-number">{stats?.total ?? "—"}</div>
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

        <section className="impact-strip">
          <div><ShieldCheck/><div><strong>Evidence-first</strong><span>Photo + location for every report</span></div></div>
          <div><Activity/><div><strong>Trackable</strong><span>Every status change is recorded</span></div></div>
          <div><CheckCircle2/><div><strong>Accountable</strong><span>Public updates show what happened</span></div></div>
        </section>

        <section id="issues" className="content-section">
          <div className="section-heading">
            <div><div className="eyebrow">COMMUNITY REPORTS</div><h2>See what needs attention.</h2></div>
            <button className="btn btn-outline" onClick={() => setShowMap(!showMap)}><Map size={17}/> {showMap ? "List view" : "Map view"}</button>
          </div>
          <div className="filters">
            <label className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Search reports, locations or reference..." /></label>
            <select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select>
            <select value={status} onChange={e => setStatus(e.target.value)}>{["All","Submitted","Under Review","Assigned","In Progress","Resolved","Rejected"].map(s => <option key={s}>{s}</option>)}</select>
            <button className="btn btn-outline filter-button"><Filter size={16}/> Filters</button>
          </div>
          {showMap ? <IssueMap reports={filtered} onOpen={openReport}/> :
            <div className="report-grid">{filtered.map(r => <ReportCard key={r.reference} report={r} onOpen={openReport}/>)}</div>}
          {!filtered.length && <div className="empty">No reports match your filters.</div>}
        </section>
      </main>

      <footer><Logo/><span>© 2026 CivicPort · Report. Track. Resolve.</span></footer>

      {showReport && <ReportForm onClose={() => setShowReport(false)} onCreated={async r => { setShowReport(false); await load(); setSelected(r); }}/>}
      {selected && <Modal wide onClose={() => setSelected(null)}>
        <div className="modal-header"><div><div className="report-ref">{selected.reference}</div><h2>{selected.title}</h2><p>{selected.locationLabel}</p></div><StatusBadge status={selected.status}/></div>
        {selected.photoUrl && <img className="detail-photo" src={selected.photoUrl} alt={selected.title}/>}
        <p className="detail-description">{selected.description}</p>
        <div className="detail-grid"><div><span>Category</span><strong>{selected.category}</strong></div><div><span>Priority</span><strong>{selected.priority}</strong></div><div><span>Department</span><strong>{selected.department || "Pending assignment"}</strong></div></div>
        <h3 className="subheading">Progress</h3>
        <Timeline report={selected}/>
        <div className="updates">
          {(selected.updates || []).filter(u => u.isPublic).map(u => u.photoUrl ? <img key={u.id} src={u.photoUrl} className="update-photo" alt="Progress update"/> : null)}
        </div>
      </Modal>}
    </div>
  );
}

function ReportForm({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: "",
    category: "Roads",
    description: "",
    latitude: "",
    longitude: "",
    locationLabel: "",
    accuracy: ""
  });

  const [photo, setPhoto] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locationDetected, setLocationDetected] = useState(false);

  async function reverseGeocode(latitude, longitude) {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: latitude,
      lon: longitude,
      zoom: "18",
      addressdetails: "1",
      layer: "address"
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error("Unable to identify the location name.");
    }

    const data = await response.json();

    if (!data || !data.address) {
      throw new Error("No readable address was found for this location.");
    }

    const address = data.address;

    /*
      Nominatim may return different administrative fields
      depending on the location.

      For Lagos/Nigeria we prioritize:

      road
      neighbourhood
      suburb
      city/town/village
      state
      country
    */

    const road =
      address.road ||
      address.pedestrian ||
      address.footway ||
      address.highway;

    const neighbourhood =
      address.neighbourhood ||
      address.quarter ||
      address.suburb ||
      address.village;

    const city =
      address.city ||
      address.town ||
      address.municipality ||
      address.village;

    const state = address.state;

    const parts = [];

    if (road) parts.push(road);

    if (
      neighbourhood &&
      neighbourhood.toLowerCase() !== road?.toLowerCase()
    ) {
      parts.push(neighbourhood);
    }

    if (
      city &&
      !parts.some(
        p => p.toLowerCase() === city.toLowerCase()
      )
    ) {
      parts.push(city);
    }

    if (
      state &&
      !parts.some(
        p => p.toLowerCase() === state.toLowerCase()
      )
    ) {
      parts.push(state);
    }

    const readableLocation =
      parts.length > 0
        ? parts.join(", ")
        : data.display_name || "Location detected";

    return {
      label: readableLocation,
      fullAddress: data.display_name || readableLocation,
      address
    };
  }

  function locate() {
    if (!navigator.geolocation) {
      setError(
        "Your browser does not support GPS location."
      );
      return;
    }

    setLocating(true);
    setError("");
    setLocationDetected(false);

    navigator.geolocation.getCurrentPosition(
      async position => {
        try {
          const {
            latitude,
            longitude,
            accuracy
          } = position.coords;

          /*
            First save the precise GPS position immediately.
          */

          setForm(previous => ({
            ...previous,
            latitude,
            longitude,
            accuracy
          }));

          /*
            Now convert GPS coordinates into
            a human-readable address.
          */

          const location = await reverseGeocode(
            latitude,
            longitude
          );

          setForm(previous => ({
            ...previous,
            latitude,
            longitude,
            accuracy,
            locationLabel: location.label
          }));

          setLocationDetected(true);
        } catch (geocodeError) {
          console.error(
            "Reverse geocoding failed:",
            geocodeError
          );

          /*
            GPS is still valid even if the address
            lookup fails.
          */

          setForm(previous => ({
            ...previous,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            locationLabel:
              `${position.coords.latitude.toFixed(6)}, ` +
              `${position.coords.longitude.toFixed(6)}`
          }));

          setLocationDetected(true);

          setError(
            "GPS location detected, but the street name could not be identified."
          );
        } finally {
          setLocating(false);
        }
      },

      error => {
        console.error("Geolocation error:", error);

        let message =
          "Unable to determine your location.";

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          message =
            "Location permission was denied. Please allow location access in your browser and try again.";
        } else if (
          error.code ===
          error.POSITION_UNAVAILABLE
        ) {
          message =
            "Your current location could not be determined. Please try again outdoors or enable GPS.";
        } else if (
          error.code ===
          error.TIMEOUT
        ) {
          message =
            "Location detection timed out. Please try again.";
        }

        setError(message);
        setLocating(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  }

  async function submit(e) {
    e.preventDefault();

    setSaving(true);
    setError("");

    try {
      /*
        Prevent accidental submission without
        location if CivicPort requires location.
      */

      if (!form.latitude || !form.longitude) {
        throw new Error(
          "Please detect your location before submitting the report."
        );
      }

      const fd = new FormData();

      fd.append("title", form.title);
      fd.append("category", form.category);
      fd.append("description", form.description);

      /*
        Precise GPS coordinates
      */

      fd.append(
        "latitude",
        String(form.latitude)
      );

      fd.append(
        "longitude",
        String(form.longitude)
      );

      /*
        Human-readable location
      */

      fd.append(
        "locationLabel",
        form.locationLabel ||
          `${Number(form.latitude).toFixed(6)}, ${Number(form.longitude).toFixed(6)}`
      );

      /*
        GPS accuracy metadata
      */

      if (form.accuracy) {
        fd.append(
          "accuracy",
          String(form.accuracy)
        );
      }

      if (photo) {
        fd.append("photo", photo);
      }

      const report = await api.createReport(fd);

      onCreated(report);
    } catch (e) {
      console.error("Report submission failed:", e);
      setError(e.message || "Unable to submit report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <div>
          <div className="eyebrow">
            NEW CIVIC REPORT
          </div>

          <h2>Make the issue visible.</h2>

          <p>
            Give the responsible team enough evidence
            to act.
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
              setForm({
                ...form,
                title: e.target.value
              })
            }
            placeholder="e.g. Large pothole on Opebi Road"
          />
        </label>

        <label>
          Category

          <select
            value={form.category}
            onChange={e =>
              setForm({
                ...form,
                category: e.target.value
              })
            }
          >
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
        </label>

        <label>
          Description

          <textarea
            required
            value={form.description}
            onChange={e =>
              setForm({
                ...form,
                description: e.target.value
              })
            }
            placeholder="Describe what is happening and why it matters."
            rows="4"
          />
        </label>

        <label>
          Photo

          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={e =>
              setPhoto(
                e.target.files?.[0] || null
              )
            }
          />
        </label>

        {/* LOCATION */}

        <div className="location-box">
          <div className="location-header">
            <div>
              <strong>
                📍 Report location
              </strong>

              <span>
                {locating
                  ? "Detecting your location..."
                  : form.locationLabel ||
                    "Location not captured yet"}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={locate}
              disabled={locating}
            >
              {locating
                ? "Locating..."
                : form.latitude
                  ? "Update location"
                  : "Use my location"}
            </button>
          </div>

          {/* MINI MAP */}

          {form.latitude &&
            form.longitude && (
              <div
                style={{
                  marginTop: "14px",
                  borderRadius: "14px",
                  overflow: "hidden",
                  height: "240px",
                  border:
                    "1px solid rgba(0,0,0,0.08)"
                }}
              >
                <MapContainer
                  center={[
                    Number(form.latitude),
                    Number(form.longitude)
                  ]}
                  zoom={17}
                  scrollWheelZoom={false}
                  dragging={true}
                  doubleClickZoom={false}
                  className="location-mini-map"
                  style={{
                    width: "100%",
                    height: "100%"
                  }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Marker
                    position={[
                      Number(form.latitude),
                      Number(form.longitude)
                    ]}
                    icon={userLocationIcon}
                  >
                    <Popup>
                      <strong>
                        You are here
                      </strong>

                      <br />

                      {form.locationLabel}

                      <br />

                      <small>
                        Accuracy:{" "}
                        {form.accuracy
                          ? `±${Math.round(
                              Number(
                                form.accuracy
                              )
                            )}m`
                          : "Unknown"}
                      </small>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            )}

          {/* LOCATION DETAILS */}

          {form.latitude &&
            form.longitude && (
              <div className="location-details">
                <div>
                  <span>
                    Location
                  </span>

                  <strong>
                    {form.locationLabel}
                  </strong>
                </div>

                <div>
                  <span>
                    GPS coordinates
                  </span>

                  <strong>
                    {Number(
                      form.latitude
                    ).toFixed(6)}
                    ,{" "}
                    {Number(
                      form.longitude
                    ).toFixed(6)}
                  </strong>
                </div>

                {form.accuracy && (
                  <div>
                    <span>
                      GPS accuracy
                    </span>

                    <strong>
                      ±
                      {Math.round(
                        Number(
                          form.accuracy
                        )
                      )}
                      m
                    </strong>
                  </div>
                )}
              </div>
            )}

          {locationDetected && (
            <div className="location-success">
              ✓ Location detected and identified
            </div>
          )}
        </div>

        {error && (
          <div className="form-error">
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-large"
          disabled={saving || locating}
        >
          {saving
            ? "Submitting..."
            : "Submit civic report"}

          <ArrowRight size={18} />
        </button>
      </form>
    </Modal>
  );
}
