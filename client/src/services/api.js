const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export const api = {
  stats: () => request("/stats"),
  reports: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v && v !== "All"));
    return request(`/reports${qs.toString() ? `?${qs}` : ""}`);
  },
  report: (reference) => request(`/reports/${reference}`),
  createReport: (formData) => request("/reports", { method: "POST", body: formData }),
  updateStatus: (reference, body) => request(`/reports/${reference}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }),
  assignment: (reference, body) => request(`/reports/${reference}/assignment`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  }),
  addUpdate: (reference, formData) => request(`/reports/${reference}/updates`, { method: "POST", body: formData })
};
