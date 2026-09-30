const API = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api`;

async function request(path, options = {}) {
  const response = await fetch(
    `${API}${path}`,
    {
      ...options,
      credentials: "include",
    }
  );

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
    const error = new Error(
      data.error ||
      data.message ||
      `Request failed with status ${response.status}.`
    );

    // Preserve structured backend information so the UI
    // can respond intelligently to location verification
    // failures and other API errors.
    error.status = response.status;
    error.data = data;
    error.missingFields = Array.isArray(data.missingFields)
      ? data.missingFields
      : [];
    error.locationVerified = data.locationVerified;
    error.locationSource = data.locationSource;
    error.requiresUserInput = data.requiresUserInput;

    throw error;
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
        ([, v]) => v !== undefined && v !== null && v !== "" && v !== "All"
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
     REJECT REPORT
     
     Destructive action requiring administrator
     password verification on the backend.
  ===================================================== */

  rejectReport: (reference, body) =>
    request(`/reports/${reference}/reject`, {
      method: "POST",
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
     AI CIVIC INTELLIGENCE
  ===================================================== */

  aiStatus: () =>
    request("/ai/status"),

  aiAnalyzeReport: (reference) =>
    request(`/ai/reports/${reference}/analyze`, {
      method: "POST",
    }),

  aiReportBrief: (reference) =>
    request(`/ai/reports/${reference}/brief`, {
      method: "POST",
    }),

  aiOperations: () =>
    request("/ai/operations", {
      method: "POST",
    }),

  /* =====================================================
    GOVERNMENT AUTHENTICATION
  ===================================================== */

  governmentLogin: (
    email,
    password
  ) =>
    request(
      "/auth/government-login",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          email,
          password,
        }),
      }
    ),

  governmentLogout: () =>
    request(
      "/auth/government-logout",
      {
        method: "POST",
      }
    ),

  governmentMe: () =>
    request("/auth/me"),
};
