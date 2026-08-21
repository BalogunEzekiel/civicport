import React from "react";
import { Check, Circle } from "lucide-react";
import StatusBadge from "./StatusBadge";

const order = ["Submitted", "Under Review", "Assigned", "In Progress", "Resolved"];

export default function Timeline({ report }) {
  const updates = report.updates || [];
  return (
    <div className="timeline">
      {order.map((status) => {
        const update = [...updates].reverse().find(u => u.status === status);
        return (
          <div className={`timeline-item ${update ? "done" : ""}`} key={status}>
            <div className="timeline-dot">{update ? <Check size={14} /> : <Circle size={10} />}</div>
            <div className="timeline-content">
              <div className="timeline-head"><strong>{status}</strong>{update && <StatusBadge status={status} />}</div>
              {update && <><p>{update.message}</p><small>{new Date(update.createdAt).toLocaleString()}</small></>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
