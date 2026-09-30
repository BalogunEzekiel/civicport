import React from "react";
import { ArrowUpRight, MapPin } from "lucide-react";
import StatusBadge from "./StatusBadge";

export default function ReportCard({ report, onOpen }) {
  return (
    <button className="report-card" onClick={() => onOpen(report.reference)}>
      <div className="report-image">
        {report.photoUrl ? <img src={report.photoUrl} alt="" /> : <div className="image-placeholder">CIVIC</div>}
        <span className="category-pill">{report.category}</span>
      </div>
      <div className="report-body">
        <div className="report-ref">{report.reference}</div>
        <h3>{report.title}</h3>
        <p>{report.description}</p>
        <div className="report-meta"><MapPin size={15} /> {report.locationLabel || "Location captured"}</div>
        <div className="report-footer">
          <StatusBadge status={report.status} />
          <ArrowUpRight size={18} />
        </div>
      </div>
    </button>
  );
}
