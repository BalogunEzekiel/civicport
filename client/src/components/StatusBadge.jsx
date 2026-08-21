import React from "react";
import { CircleCheck, CircleDot, Clock3, Eye, XCircle } from "lucide-react";

const config = {
  Submitted: ["status-submitted", CircleDot],
  "Under Review": ["status-review", Eye],
  Assigned: ["status-assigned", Clock3],
  "In Progress": ["status-progress", Clock3],
  Resolved: ["status-resolved", CircleCheck],
  Rejected: ["status-rejected", XCircle]
};

export default function StatusBadge({ status }) {
  const [cls, Icon] = config[status] || config.Submitted;
  return <span className={`status-badge ${cls}`}><Icon size={14} /> {status}</span>;
}
