const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);

  const text = await response.text();

  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      `Request failed with status ${response.status}.`
    );
  }

  return data;
}

export const api = {
  /* =====================================================
     DASHBOARD STATISTICS
  ===================================================== */

  stats: () => request("/stats"),

  /* =====================================================
     REPORTS
  ===================================================== */

  reports: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(
        ([, v]) => v && v !== "All"
      )
    );

    return request(
      `/reports${qs.toString() ? `?${qs}` : ""}`
    );
  },

  report: (reference) =>
    request(`/reports/${reference}`),

  /* =====================================================
     CREATE REPORT
  ===================================================== */

  createReport: (formData) =>
    request("/reports", {
      method: "POST",
      body: formData,
    }),

  /* =====================================================
     UPDATE STATUS
  ===================================================== */

  updateStatus: (reference, body) =>
    request(`/reports/${reference}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),

  /* =====================================================
     ASSIGNMENT
  ===================================================== */

  assignment: (reference, body) =>
    request(`/reports/${reference}/assignment`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),

  /* =====================================================
     ADD REPORT UPDATE
  ===================================================== */

  addUpdate: (reference, formData) =>
    request(`/reports/${reference}/updates`, {
      method: "POST",
      body: formData,
    }),

  /* =====================================================
     GOVERNMENT LOGIN
  ===================================================== */

  governmentLogin: (email, password) =>
    request("/auth/government-login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        email,
        password,
      }),
    }),
};