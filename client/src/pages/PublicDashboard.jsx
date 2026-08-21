import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CheckCircle2, Filter, Map, Search, ShieldCheck, Siren } from "lucide-react";
import Logo from "../components/Logo";
import ReportCard from "../components/ReportCard";
import IssueMap from "../components/IssueMap";
import Modal from "../components/Modal";
import Timeline from "../components/Timeline";
import StatusBadge from "../components/StatusBadge";
import { api } from "../services/api";

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
  const [form, setForm] = useState({ title:"", category:"Roads", description:"", latitude:"", longitude:"", locationLabel:"" });
  const [photo, setPhoto] = useState(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function locate() {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      p => { setForm(f => ({...f, latitude:p.coords.latitude, longitude:p.coords.longitude, locationLabel:`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`})); setLocating(false); },
      () => { setError("Location permission was not available. You can still submit without GPS."); setLocating(false); }
    );
  }

  async function submit(e) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k,v));
      if (photo) fd.append("photo", photo);
      const r = await api.createReport(fd);
      onCreated(r);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return <Modal onClose={onClose}>
    <div className="modal-header"><div><div className="eyebrow">NEW CIVIC REPORT</div><h2>Make the issue visible.</h2><p>Give the responsible team enough evidence to act.</p></div></div>
    <form onSubmit={submit} className="form">
      <label>Issue title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Large pothole on Ikeja road"/></label>
      <label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Description<textarea required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe what is happening and why it matters." rows="4"/></label>
      <label>Photo <input type="file" accept="image/*" capture="environment" onChange={e=>setPhoto(e.target.files?.[0] || null)}/></label>
      <div className="location-box"><div><strong>📍 Location</strong><span>{form.locationLabel || "Not captured yet"}</span></div><button type="button" className="btn btn-outline" onClick={locate}>{locating ? "Locating..." : "Use my location"}</button></div>
      {error && <div className="form-error">{error}</div>}
      <button className="btn btn-primary btn-large" disabled={saving}>{saving ? "Submitting..." : "Submit civic report"} <ArrowRight size={18}/></button>
    </form>
  </Modal>
}
