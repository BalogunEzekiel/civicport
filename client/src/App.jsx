import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PublicDashboard from "./pages/PublicDashboard";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  return <BrowserRouter><Routes><Route path="/" element={<PublicDashboard/>}/><Route path="/admin" element={<AdminDashboard/>}/></Routes></BrowserRouter>;
}
