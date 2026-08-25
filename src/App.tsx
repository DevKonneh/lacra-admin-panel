import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RegisterFarmer from './pages/RegisterFarmer';
import PublicFarmerProfile from './pages/PublicFarmerProfile';
import FarmersList from './pages/farmers/FarmersList';
import FarmerProfile from './pages/farmers/FarmerProfile';
import FarmsList from './pages/farms/FarmsList';
import CreateFarm from './pages/farms/CreateFarm';
import FarmDetails from './pages/farms/FarmDetails';
import RiskAnalysis from './pages/RiskAnalysis';
import MapView from './pages/MapView';
import LicenseDashboard from './pages/licenses/LicenseDashboard';
import AdminLicenseList from './pages/admin/LicenseList';
import BatchManager from './pages/logistics/BatchManager';
import ExportManager from './pages/export/ExportManager';
import ChainOfCustody from './pages/custody/ChainOfCustody';
import CustodyHistoryPage from './pages/custody/CustodyHistory';
import SatelliteAnalysis from './pages/SatelliteAnalysis';
import Login from './pages/Login';
import Register from './pages/Register';
import PendingApprovals from './pages/admin/PendingApprovals';
import RoleList from './pages/admin/RoleList';
import RoleForm from './pages/admin/RoleForm';
import UserList from './pages/admin/UserList';
import UserForm from './pages/admin/UserForm';
import BusinessList from './pages/admin/business/BusinessList';
import BusinessRegister from './pages/admin/business/BusinessRegister';
import LicenseList from './pages/licenses/LicenseList';
import LicenseApplication from './pages/licenses/LicenseApplication';
import PermitList from './pages/permits/PermitList';
import PermitApplication from './pages/permits/PermitApplication';
import InspectionList from './pages/inspections/InspectionList';
import QualityControlList from './pages/quality/QualityControlList';
import EnforcementList from './pages/enforcement/EnforcementList';
import InspectionForm from './pages/inspections/InspectionForm';
import QualityControlForm from './pages/quality/QualityControlForm';
import { AuthProvider, useAuth } from './context/AuthContext';

// Protected Route Component
const PrivateRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

import PublicBatchDetails from './pages/PublicBatchDetails';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/public/farmers/:id" element={<PublicFarmerProfile />} />
          <Route path="/public/batches/:id" element={<PublicBatchDetails />} />
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="farmers/register" element={<RegisterFarmer />} />
              <Route path="farmers" element={<FarmersList />} />
              <Route path="farmers/:id" element={<FarmerProfile />} />
              <Route path="farms" element={<FarmsList />} />
              <Route path="farms/new" element={<CreateFarm />} />
              <Route path="farms/:id" element={<FarmDetails />} />
              <Route path="risk-analysis" element={<RiskAnalysis />} />
              <Route path="map" element={<MapView />} />
              <Route path="licenses" element={<LicenseDashboard />} />
              <Route path="admin/licenses" element={<AdminLicenseList />} />
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
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
