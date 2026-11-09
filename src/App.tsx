import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './types';

// ---------------------------------------------------------------------------
// Route-level code-splitting.
//
// The production build was exceeding the PWA precache's default 2 MiB
// per-file limit because almost every page in the app (plus heavy
// dependencies such as leaflet, recharts, jspdf, xlsx and jsqr that are
// only used by a handful of pages) was being bundled eagerly into a single
// ~2.1 MB main chunk. Per the rollout decision, we fix this by splitting
// the bundle with React.lazy()/dynamic import() rather than raising the
// workbox `maximumFileSizeToCacheInBytes` limit in vite.config.ts.
//
// Only the screens needed to render the very first authenticated frame
// (Dashboard) and the public entry point (Login) stay eagerly imported;
// everything else is fetched on demand the first time a route is visited,
// each landing in its own chunk. A single <Suspense> boundary around the
// whole <Routes> tree (see below) shows one lightweight loading state
// while any lazy chunk is fetched.
// ---------------------------------------------------------------------------
const RegisterFarmer = lazy(() => import('./pages/RegisterFarmer'));
const PublicFarmerProfile = lazy(() => import('./pages/PublicFarmerProfile'));
const FarmersList = lazy(() => import('./pages/farmers/FarmersList'));
const FarmerProfile = lazy(() => import('./pages/farmers/FarmerProfile'));
const VerificationQueue = lazy(() => import('./pages/farmers/VerificationQueue'));
const FarmsList = lazy(() => import('./pages/farms/FarmsList'));
const CreateFarm = lazy(() => import('./pages/farms/CreateFarm'));
const FarmDetails = lazy(() => import('./pages/farms/FarmDetails'));
const DataCorrectionQueue = lazy(() => import('./pages/farms/DataCorrectionQueue'));
const RiskAnalysis = lazy(() => import('./pages/RiskAnalysis'));
const MapView = lazy(() => import('./pages/MapView'));
const LicenseDashboard = lazy(() => import('./pages/licenses/LicenseDashboard'));
const ManualLicenseEntryForm = lazy(() => import('./pages/licenses/ManualLicenseEntryForm'));
const AdminLicenseList = lazy(() => import('./pages/admin/LicenseList'));
const CooperativeRegistry = lazy(() => import('./pages/admin/CooperativeRegistry'));
const CooperativeRegistryManage = lazy(() => import('./pages/admin/CooperativeRegistryManage'));
const BatchManager = lazy(() => import('./pages/logistics/BatchManager'));
const ExportManager = lazy(() => import('./pages/export/ExportManager'));
const ChainOfCustody = lazy(() => import('./pages/custody/ChainOfCustody'));
const CustodyHistoryPage = lazy(() => import('./pages/custody/CustodyHistory'));
const SatelliteAnalysis = lazy(() => import('./pages/SatelliteAnalysis'));
const Register = lazy(() => import('./pages/Register'));
const PendingApprovals = lazy(() => import('./pages/admin/PendingApprovals'));
const RoleList = lazy(() => import('./pages/admin/RoleList'));
const RoleForm = lazy(() => import('./pages/admin/RoleForm'));
const UserList = lazy(() => import('./pages/admin/UserList'));
const UserForm = lazy(() => import('./pages/admin/UserForm'));
const BusinessList = lazy(() => import('./pages/admin/business/BusinessList'));
const BusinessRegister = lazy(() => import('./pages/admin/business/BusinessRegister'));
const LicenseList = lazy(() => import('./pages/licenses/LicenseList'));
const LicenseApplication = lazy(() => import('./pages/licenses/LicenseApplication'));
const PermitList = lazy(() => import('./pages/permits/PermitList'));
const PermitApplication = lazy(() => import('./pages/permits/PermitApplication'));
const LocalProduceBuyerRegister = lazy(() => import('./pages/permits/LocalProduceBuyerRegister'));
const AgencyRegister = lazy(() => import('./pages/permits/AgencyRegister'));
const AgencyProfile = lazy(() => import('./pages/permits/AgencyProfile'));
const ExporterRegister = lazy(() => import('./pages/permits/ExporterRegister'));
const ExporterProfile = lazy(() => import('./pages/permits/ExporterProfile'));
const CooperativeRegister = lazy(() => import('./pages/permits/CooperativeRegister'));
const CooperativeProfile = lazy(() => import('./pages/permits/CooperativeProfile'));
const InspectionList = lazy(() => import('./pages/inspections/InspectionList'));
const QualityControlList = lazy(() => import('./pages/quality/QualityControlList'));
const EnforcementList = lazy(() => import('./pages/enforcement/EnforcementList'));
const InspectionForm = lazy(() => import('./pages/inspections/InspectionForm'));
const QualityControlForm = lazy(() => import('./pages/quality/QualityControlForm'));
const PublicBatchDetails = lazy(() => import('./pages/PublicBatchDetails'));
const CertificateVerify = lazy(() => import('./pages/CertificateVerify'));
const LocalProduceBuyerVerify = lazy(() => import('./pages/LocalProduceBuyerVerify'));
const AgencyVerify = lazy(() => import('./pages/AgencyVerify'));
const AgentVerify = lazy(() => import('./pages/AgentVerify'));
const ExporterVerify = lazy(() => import('./pages/ExporterVerify'));
const CooperativeVerify = lazy(() => import('./pages/CooperativeVerify'));
const ApplicationWizard = lazy(() => import('./pages/apply/ApplicationWizard'));
const CommercialQueue = lazy(() => import('./pages/applications/CommercialQueue'));
const CommercialApplicationReview = lazy(() => import('./pages/applications/CommercialApplicationReview'));
const DGApprovalQueue = lazy(() => import('./pages/applications/DGApprovalQueue'));
const DGApplicationReview = lazy(() => import('./pages/applications/DGApplicationReview'));
const ApplicationDetail = lazy(() => import('./pages/applications/ApplicationDetail'));
const TechnicalReviewQueue = lazy(() => import('./pages/applications/TechnicalReviewQueue'));
const InspectorQueue = lazy(() => import('./pages/applications/InspectorQueue'));
const BillingQueue = lazy(() => import('./pages/applications/BillingQueue'));
const PaymentQueue = lazy(() => import('./pages/applications/PaymentQueue'));
const ITQueue = lazy(() => import('./pages/applications/ITQueue'));
const UserActivity = lazy(() => import('./pages/monitoring/UserActivity'));
const EnumeratorList = lazy(() => import('./pages/monitoring/EnumeratorList'));
const EnumeratorDetail = lazy(() => import('./pages/monitoring/EnumeratorDetail'));

// Protected Route Component
const PrivateRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

// Admin-only route — used for registry maintenance screens (e.g. the
// Cooperative Registry's "Import CDA Records" workflow) that must stay
// behind an authorised-staff gate, separate from the registry's regular
// read/browse page which any authenticated staff member can view.
const AdminRoute = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  return isAdmin ? <Outlet /> : <Navigate to="/" />;
};

// Identity Verification queue access — ADMIN + INSPECTOR can both VIEW the
// queue (matches the backend's GET /farmers/verification/queue, gated
// ADMIN+INSPECTOR), since inspectors can use their existing correction
// permissions to fix flagged data. The actual verify/flag-conflict/revert/
// bulk ACTIONS are a separate concern: VerificationQueue.tsx and
// FarmerProfile.tsx only render those buttons for ADMIN, and the backend
// re-enforces ADMIN-only on every write endpoint independently (route
// middleware AND FarmerController.canManageVerification) — this route
// guard only controls read access to the page.
const AdminOrInspectorRoute = () => {
  const { user } = useAuth();
  const allowed = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.INSPECTOR;
  return allowed ? <Outlet /> : <Navigate to="/" />;
};

// CMIS Monitoring ("Field Progress") access — ADMIN/SUPER_ADMIN see every
// enumerator; FIELD_SUPERVISOR sees only their own direct reports (scoped
// server-side, live, on every request — see MonitoringAccessService). This
// guard only controls whether the page itself renders; the backend
// independently re-enforces per-enumerator visibility and returns 403 for
// anything a field supervisor isn't (or no longer is) allowed to see.
const AdminOrSupervisorRoute = () => {
  const { user } = useAuth();
  const allowed = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.FIELD_SUPERVISOR;
  return allowed ? <Outlet /> : <Navigate to="/" />;
};

// Single Suspense boundary for every lazy route below. Using one boundary
// around the whole <Routes> tree (rather than one per-route) keeps the
// loading UI consistent across the app and avoids repeating the same
// fallback markup for ~45 routes.
const RouteFallback = () => (
  <div className="flex items-center justify-center p-12 text-sm text-gray-400">Loading…</div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/public/farmers/:id" element={<PublicFarmerProfile />} />
            <Route path="/public/batches/:id" element={<PublicBatchDetails />} />
            <Route path="/verify/:certificateNumber" element={<CertificateVerify />} />
            <Route path="/verify/local-produce-buyers/:token" element={<LocalProduceBuyerVerify />} />
            <Route path="/verify/agencies/:token" element={<AgencyVerify />} />
            <Route path="/verify/agents/:token" element={<AgentVerify />} />
            <Route path="/verify/exporters/:token" element={<ExporterVerify />} />
            <Route path="/verify/cooperatives/:token" element={<CooperativeVerify />} />
            <Route path="/apply" element={<ApplicationWizard />} />
            <Route element={<PrivateRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="farmers/register" element={<RegisterFarmer />} />
                <Route path="farmers" element={<FarmersList />} />
                <Route path="farmers/:id" element={<FarmerProfile />} />
                <Route element={<AdminOrInspectorRoute />}>
                  <Route path="farmers/verification" element={<VerificationQueue />} />
                </Route>
                <Route path="farms" element={<FarmsList />} />
                <Route path="farms/new" element={<CreateFarm />} />
                <Route element={<AdminOrInspectorRoute />}>
                  <Route path="farms/data-correction-queue" element={<DataCorrectionQueue />} />
                </Route>
                <Route path="farms/:id" element={<FarmDetails />} />
                <Route path="risk-analysis" element={<RiskAnalysis />} />
                <Route path="map" element={<MapView />} />
                <Route path="licenses" element={<LicenseDashboard />} />
                <Route path="licenses/register-manual" element={<ManualLicenseEntryForm />} />
                <Route path="admin/licenses" element={<AdminLicenseList />} />
                <Route path="admin/cooperatives" element={<CooperativeRegistry />} />
                <Route element={<AdminRoute />}>
                  <Route path="admin/cooperatives/import" element={<CooperativeRegistryManage />} />
                </Route>
                <Route path="logistics" element={<BatchManager />} />
                <Route path="custody" element={<ChainOfCustody />} />
                <Route path="custody/batch/:batchId" element={<CustodyHistoryPage />} />
                <Route path="export" element={<ExportManager />} />
                <Route path="inspections" element={<InspectionList />} />
                <Route path="inspections/new" element={<InspectionForm />} />
                <Route path="quality" element={<QualityControlList />} />
                <Route path="quality/new" element={<QualityControlForm />} />
                <Route path="admin/enforcement" element={<EnforcementList />} />
                <Route path="satellite" element={<SatelliteAnalysis />} />
                <Route path="admin/approvals" element={<PendingApprovals />} />
                <Route path="admin/roles" element={<RoleList />} />
                <Route path="admin/roles/new" element={<RoleForm />} />
                <Route path="admin/roles/:id" element={<RoleForm />} />
                <Route path="admin/users" element={<UserList />} />
                <Route path="admin/users/new" element={<UserForm />} />
                <Route path="admin/users/:id" element={<UserForm />} />

                {/* Business Registry */}
                <Route path="admin/business" element={<BusinessList />} />
                <Route path="admin/business/register" element={<BusinessRegister />} />

                {/* License Management */}
                <Route path="licenses" element={<LicenseList />} />
                <Route path="licenses/apply" element={<LicenseApplication />} />

                {/* Permit Management */}
                <Route path="permits" element={<PermitList />} />
                <Route path="permits/apply" element={<PermitApplication />} />
                <Route path="permits/local-produce-buyers" element={<LocalProduceBuyerRegister />} />
                <Route path="permits/agencies" element={<AgencyRegister />} />
                <Route path="permits/agencies/:id" element={<AgencyProfile />} />
                <Route path="permits/exporters" element={<ExporterRegister />} />
                <Route path="permits/exporters/:id" element={<ExporterProfile />} />
                <Route path="permits/cooperatives" element={<CooperativeRegister />} />
                <Route path="permits/cooperatives/:id" element={<CooperativeProfile />} />

                {/* Application Workflow: Commercial Verification + First DG Approval */}
                <Route path="applications/commercial-queue" element={<CommercialQueue />} />
                <Route path="applications/commercial/:id" element={<CommercialApplicationReview />} />
                <Route path="applications/dg-queue" element={<DGApprovalQueue />} />
                <Route path="applications/dg/:id" element={<DGApplicationReview />} />

                {/* Application Workflow Phase 3: Technical Review + Inspector
                    Assignment + Warehouse Assessment + Second DG Approval */}
                <Route path="applications/technical-queue" element={<TechnicalReviewQueue />} />
                <Route path="applications/inspection-queue" element={<InspectorQueue />} />

                {/* Application Workflow Phase 4: Billing Review + Payment
                    Verification + Final DG Approval + IT Certificate
                    Printing/Issuance */}
                <Route path="applications/billing-queue" element={<BillingQueue />} />
                <Route path="applications/payment-queue" element={<PaymentQueue />} />
                <Route path="applications/it-queue" element={<ITQueue />} />

                <Route path="applications/:id" element={<ApplicationDetail />} />

                {/* CMIS Monitoring ("Field Progress") */}
                <Route element={<AdminRoute />}>
                  <Route path="monitoring/user-activity" element={<UserActivity />} />
                </Route>
                <Route element={<AdminOrSupervisorRoute />}>
                  <Route path="monitoring/enumerators" element={<EnumeratorList />} />
                  <Route path="monitoring/enumerators/:id" element={<EnumeratorDetail />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
