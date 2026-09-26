import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";

import Login from "./pages/auth/Login.jsx";

import FarmerDashboard from "./pages/farmer/Dashboard.jsx";
import FarmerProfile from "./pages/farmer/Profile.jsx";
import FarmerCrops from "./pages/farmer/Crops.jsx";
import FarmerYield from "./pages/farmer/Yield.jsx";
import FarmerInsurance from "./pages/farmer/Insurance.jsx";
import FarmerAssistance from "./pages/farmer/Assistance.jsx";
import FarmerEligibility from "./pages/farmer/Eligibility.jsx";
import FarmerActivity from "./pages/farmer/Activity.jsx";
import FarmerPolicies from "./pages/farmer/Policies.jsx";
import FarmerAnnouncements from "./pages/farmer/Announcements.jsx";

import AdminDashboard from "./pages/admin/Dashboard.jsx";
import AdminFarmers from "./pages/admin/Farmers.jsx";
import AdminRequests from "./pages/admin/Requests.jsx";
import AdminYield from "./pages/admin/Yield.jsx";
import AdminInsurance from "./pages/admin/Insurance.jsx";
import AdminAssistance from "./pages/admin/Assistance.jsx";
import AdminAnnouncements from "./pages/admin/Announcements.jsx";

import PresidentDashboard from "./pages/president/Dashboard.jsx";
import Validation from "./pages/president/Validation.jsx";
import PresidentCrops from "./pages/president/Crops.jsx";
import Qualification from "./pages/president/Qualification.jsx";
import AssistanceDistribution from "./pages/president/AssistanceDistribution.jsx";
import Policies from "./pages/president/Policies.jsx";
import Meetings from "./pages/president/Meetings.jsx";
import PresidentRequests from "./pages/president/Requests.jsx";

import Association from "./pages/shared/Association.jsx";
import Reports from "./pages/shared/Reports.jsx";
import StaffProfile from "./pages/shared/StaffProfile.jsx";
import Settings from "./pages/shared/Settings.jsx";
import Notifications from "./pages/shared/Notifications.jsx";

function RootRedirect() {
  const { session, role, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <Navigate to={`/${role || "login"}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />

      {/* FARMER */}
      <Route path="/farmer" element={<ProtectedRoute allow="farmer"><Layout role="farmer" /></ProtectedRoute>}>
        <Route index element={<FarmerDashboard />} />
        <Route path="profile" element={<FarmerProfile />} />
        <Route path="crops" element={<FarmerCrops />} />
        <Route path="yield" element={<FarmerYield />} />
        <Route path="insurance" element={<FarmerInsurance />} />
        <Route path="assistance" element={<FarmerAssistance />} />
        <Route path="eligibility" element={<FarmerEligibility />} />
        <Route path="activity" element={<FarmerActivity />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="policies" element={<FarmerPolicies />} />
        <Route path="announcements" element={<FarmerAnnouncements />} />
      </Route>

      {/* ADMIN */}
      <Route path="/admin" element={<ProtectedRoute allow="admin"><Layout role="admin" /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="farmers" element={<AdminFarmers />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="yield" element={<AdminYield />} />
        <Route path="insurance" element={<AdminInsurance />} />
        <Route path="assistance" element={<AdminAssistance />} />
        <Route path="reports" element={<Reports title="Assistance Reports" />} />
        <Route path="association" element={<Association scope="admin" />} />
        <Route path="announcements" element={<AdminAnnouncements />} />
        <Route path="profile" element={<StaffProfile roleLabel="ADMIN" />} />
        <Route path="settings" element={<Settings canManagePrices />} />
      </Route>

      {/* PRESIDENT */}
      <Route path="/president" element={<ProtectedRoute allow="president"><Layout role="president" /></ProtectedRoute>}>
        <Route index element={<PresidentDashboard />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="validation" element={<Validation />} />
        <Route path="association" element={<Association scope="president" />} />
        <Route path="crops" element={<PresidentCrops />} />
        <Route path="qualification" element={<Qualification />} />
        <Route path="assistance" element={<AssistanceDistribution />} />
        <Route path="reports" element={<Reports title="Transparency Reports" />} />
        <Route path="policies" element={<Policies />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="requests" element={<PresidentRequests />} />
        <Route path="announcements" element={<AdminAnnouncements />} />
        <Route path="profile" element={<StaffProfile roleLabel="Association President" />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
