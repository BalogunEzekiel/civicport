import React from "react";
import { ShieldCheck } from "lucide-react";

export default function Logo({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark"><ShieldCheck size={19} /></span>
      <span>Civic<span>Port</span></span>
    </div>
  );
}
