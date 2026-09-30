import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import PublicDashboard from "./pages/PublicDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import GovernmentLogin from "./pages/GovernmentLogin";

function GovernmentProtectedRoute({ children }) {
  const authenticated =
    sessionStorage.getItem("governmentAuthenticated") === "true";

  if (!authenticated) {
    return (
      <Navigate
        to="/government-login"
        replace
      />
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC CITIZEN PORTAL */}
        <Route
          path="/"
          element={<PublicDashboard />}
        />

        {/* GOVERNMENT LOGIN */}
        <Route
          path="/government-login"
          element={<GovernmentLogin />}
        />

        {/* PROTECTED GOVERNMENT PORTAL */}
        <Route
          path="/admin"
          element={
            <GovernmentProtectedRoute>
              <AdminDashboard />
            </GovernmentProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}