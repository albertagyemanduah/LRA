import React, { useEffect, useRef } from "react";
import { Route, Routes, BrowserRouter as Router, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import ScrollToTop from "./components/ScrollToTop";
import { AuthProvider, useAuth } from "@/lib/auth";
import { initTheme } from "@/lib/useTheme";
import { isOperationActive } from "@/lib/operationGuard";
import { canAccess } from "@/lib/roles";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import DashboardLayout from "@/pages/dashboard/DashboardLayout";
import OverviewPage from "@/pages/dashboard/OverviewPage";
import ParcelsPage from "@/pages/dashboard/ParcelsPage";
import DocumentsPage from "@/pages/dashboard/DocumentsPage";
import SearchPage from "@/pages/dashboard/SearchPage";
import PaymentsPage from "@/pages/dashboard/PaymentsPage";
import ReportsPage from "@/pages/dashboard/ReportsPage";
import AdminPage from "@/pages/dashboard/AdminPage";
import StructurePage from "@/pages/dashboard/StructurePage";
import ChatPage from "@/pages/dashboard/ChatPage";
import ProfilePage from "@/pages/dashboard/ProfilePage";
import TicketsPage from "@/pages/dashboard/TicketsPage";
import TemplateDesignerPage from "@/pages/dashboard/TemplateDesignerPage";
import UserManualPage from "@/pages/dashboard/UserManualPage";
import UpdateNotificationsPage from "@/pages/dashboard/UpdateNotificationsPage";
import VerificationCodesPage from "@/pages/dashboard/VerificationCodesPage";
import AdminDataManagementPage from "@/pages/dashboard/AdminDataManagementPage";
import ParcelIdCorrectionPage from "@/pages/dashboard/ParcelIdCorrectionPage";
import AmendmentPage from "@/pages/dashboard/AmendmentPage";
import ApprovalPage from "@/pages/dashboard/ApprovalPage";
import TransferRequestsPage from "@/pages/dashboard/TransferRequestsPage";
import MyTransfersPage from "@/pages/dashboard/MyTransfersPage";
import MenuCustomizationPage from "@/pages/dashboard/MenuCustomizationPage";
import AdminSmsPage from "@/pages/dashboard/AdminSmsPage";
import NewsManagementPage from "@/pages/dashboard/NewsManagementPage";
import OwnershipAnalyticsPage from "@/pages/dashboard/OwnershipAnalyticsPage";
import FinancialReportsPage from "@/pages/dashboard/FinancialReportsPage";
import NotificationPreferencesPage from "@/pages/dashboard/NotificationPreferencesPage";
import NewsPage from "@/pages/NewsPage";
import NewsDetailPage from "@/pages/NewsDetailPage";
import AboutPage from "@/pages/AboutPage";
import ServicesPage from "@/pages/ServicesPage";
import ContactPage from "@/pages/ContactPage";
import FAQPage from "@/pages/FAQPage";
import VerifyLandPage from "@/pages/VerifyLandPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";

const IDLE_MS = 30 * 60 * 1000; // 30-minute session timeout

function Protected({ children }) {
  const { isAuthed, logout } = useAuth();
  const navigate = useNavigate();
  const timer = useRef(null);

  useEffect(() => {
    if (!isAuthed) return;
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (isOperationActive()) {
          // Operation in progress — defer logout by resetting the timer
          reset();
          return;
        }
        logout();
        navigate("/auth");
      }, IDLE_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [isAuthed, logout, navigate]);

  if (!isAuthed) return <Navigate to="/auth" replace />;
  return children;
}

function ModuleGuard({ moduleKey, children }) {
  const { role, roles } = useAuth();
  const effective = roles.length > 0 ? roles : [role];
  if (!effective.some((r) => canAccess(r, moduleKey))) return <Navigate to="/app" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/verify-land" element={<VerifyLandPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/news" element={<NewsPage />} />
      <Route path="/news/:id" element={<NewsDetailPage />} />
      <Route path="/articles" element={<NewsPage articleMode={true} />} />
      <Route path="/articles/:id" element={<NewsDetailPage articleMode={true} />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/app"
        element={
          <Protected>
            <DashboardLayout />
          </Protected>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="parcels" element={<ModuleGuard moduleKey="parcels"><ParcelsPage /></ModuleGuard>} />
        <Route path="documents" element={<ModuleGuard moduleKey="documents"><DocumentsPage /></ModuleGuard>} />
        <Route path="search" element={<ModuleGuard moduleKey="search"><SearchPage /></ModuleGuard>} />
        <Route path="payments" element={<ModuleGuard moduleKey="payments"><PaymentsPage /></ModuleGuard>} />
        <Route path="reports" element={<ModuleGuard moduleKey="reports"><ReportsPage /></ModuleGuard>} />
        <Route path="admin" element={<ModuleGuard moduleKey="admin"><AdminPage /></ModuleGuard>} />
        <Route path="structure" element={<ModuleGuard moduleKey="structure"><StructurePage /></ModuleGuard>} />
        <Route path="chat" element={<ModuleGuard moduleKey="chat"><ChatPage /></ModuleGuard>} />
        <Route path="chat/:userId" element={<ModuleGuard moduleKey="chat"><ChatPage /></ModuleGuard>} />
        <Route path="tickets" element={<ModuleGuard moduleKey="tickets"><TicketsPage /></ModuleGuard>} />
        <Route path="template-designer" element={<ModuleGuard moduleKey="template-designer"><TemplateDesignerPage /></ModuleGuard>} />
        <Route path="manual" element={<ModuleGuard moduleKey="manual"><UserManualPage /></ModuleGuard>} />
        <Route path="update-notifications" element={<ModuleGuard moduleKey="update-notifications"><UpdateNotificationsPage /></ModuleGuard>} />
        <Route path="verification-codes" element={<ModuleGuard moduleKey="verification-codes"><VerificationCodesPage /></ModuleGuard>} />
        <Route path="data-management" element={<ModuleGuard moduleKey="data-management"><AdminDataManagementPage /></ModuleGuard>} />
        <Route path="parcel-id-correction" element={<ModuleGuard moduleKey="parcel-id-correction"><ParcelIdCorrectionPage /></ModuleGuard>} />
        <Route path="amendments" element={<ModuleGuard moduleKey="amendments"><AmendmentPage /></ModuleGuard>} />
        <Route path="approvals" element={<ModuleGuard moduleKey="approvals"><ApprovalPage /></ModuleGuard>} />
        <Route path="transfer-requests" element={<ModuleGuard moduleKey="transfer-requests"><TransferRequestsPage /></ModuleGuard>} />
        <Route path="my-transfers" element={<ModuleGuard moduleKey="my-transfers"><MyTransfersPage /></ModuleGuard>} />
        <Route path="menu-customization" element={<ModuleGuard moduleKey="menu-customization"><MenuCustomizationPage /></ModuleGuard>} />
        <Route path="admin-sms" element={<ModuleGuard moduleKey="admin-sms"><AdminSmsPage /></ModuleGuard>} />
        <Route path="news-management" element={<ModuleGuard moduleKey="news-management"><NewsManagementPage /></ModuleGuard>} />
        <Route path="ownership-analytics" element={<ModuleGuard moduleKey="ownership-analytics"><OwnershipAnalyticsPage /></ModuleGuard>} />
        <Route path="financial-reports" element={<ModuleGuard moduleKey="financial-reports"><FinancialReportsPage /></ModuleGuard>} />
        <Route path="notification-preferences" element={<ModuleGuard moduleKey="notification-preferences"><NotificationPreferencesPage /></ModuleGuard>} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  useEffect(() => { initTheme(); }, []);
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppRoutes />
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
