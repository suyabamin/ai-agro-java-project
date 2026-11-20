import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Public Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ExploreFarmsPage } from './pages/ExploreFarmsPage';
import { JobsPage } from './pages/JobsPage';
import { AboutPage, NotFoundPage } from './pages/PlaceholderPages';

// Owner Dashboard Pages
import { DashboardPage } from './pages/DashboardPage';
import { MyFarmsPage } from './pages/MyFarmsPage';
import { RegisterFarmPage } from './pages/RegisterFarmPage';
import { FarmOverviewPage } from './pages/FarmOverviewPage';
import { FarmSettingsPage } from './pages/FarmSettingsPage';
import { EditFarmPage } from './pages/EditFarmPage';
import { FieldManagementPage } from './pages/FieldManagementPage';
import { AddFieldPage } from './pages/AddFieldPage';
import { FieldDetailsPage } from './pages/FieldDetailsPage';
import { EditFieldPage } from './pages/EditFieldPage';
import { FarmerDirectoryPage } from './pages/FarmerDirectoryPage';
import { FarmerProfilePage } from './pages/FarmerProfilePage';
import { JobListPage } from './pages/JobListPage';
import { CreateJobPage } from './pages/CreateJobPage';
import { JobDetailsPage } from './pages/JobDetailsPage';
import { ApplicationManagementPage } from './pages/ApplicationManagementPage';
import { AssignmentManagementPage } from './pages/AssignmentManagementPage';
import { CreateAssignmentPage } from './pages/CreateAssignmentPage';
import { AssignmentDetailsPage } from './pages/AssignmentDetailsPage';
import { AssignmentHistoryPage } from './pages/AssignmentHistoryPage';
import { PaymentDashboardPage } from './pages/PaymentDashboardPage';
import { PaymentLedgerPage } from './pages/PaymentLedgerPage';
import { RecordPaymentPage } from './pages/RecordPaymentPage';
import { PaymentDetailsPage } from './pages/PaymentDetailsPage';
import { ReversePaymentPage } from './pages/ReversePaymentPage';
import { ReviewManagementPage } from './pages/ReviewManagementPage';
import { CreateReviewPage } from './pages/CreateReviewPage';
import { ReviewDetailsPage } from './pages/ReviewDetailsPage';
import { AIAnalysisDashboardPage } from './pages/AIAnalysisDashboardPage';
import { UploadCropImagePage } from './pages/UploadCropImagePage';
import { AnalysisProcessingPage } from './pages/AnalysisProcessingPage';
import { AnalysisResultPage } from './pages/AnalysisResultPage';
import { AnalysisHistoryPage } from './pages/AnalysisHistoryPage';
import { SoilMonitoringDashboardPage } from './pages/SoilMonitoringDashboardPage';
import { TelemetryHistoryPage } from './pages/TelemetryHistoryPage';
import { TelemetryDetailsPage } from './pages/TelemetryDetailsPage';
import { IrrigationDashboardPage } from './pages/IrrigationDashboardPage';
import { CreateIrrigationPlanPage } from './pages/CreateIrrigationPlanPage';
import { IrrigationPlanDetailsPage } from './pages/IrrigationPlanDetailsPage';
import { IrrigationHistoryPage } from './pages/IrrigationHistoryPage';
import { ActivityDashboardPage } from './pages/ActivityDashboardPage';
import { FullHistoryPage } from './pages/FullHistoryPage';
import { ActivityDetailsPage } from './pages/ActivityDetailsPage';
import { ProfilePage } from './pages/ProfilePage';
import { AccountSecurityPage } from './pages/AccountSecurityPage';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage';

// Farmer Workspace Pages
import { FarmerDashboardPage } from './pages/FarmerDashboardPage';
import { FarmerFieldsPage } from './pages/FarmerFieldsPage';
import { FarmerFieldDetailsPage } from './pages/FarmerFieldDetailsPage';
import { FarmerAssignmentsPage } from './pages/FarmerAssignmentsPage';
import { FarmerPaymentsPage } from './pages/FarmerPaymentsPage';
import { FarmerReviewsPage } from './pages/FarmerReviewsPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';

export function App() {
  return (
    <AuthProvider>
      <FarmProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/explore" element={<ExploreFarmsPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Authenticated Owner Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="farms" element={<MyFarmsPage />} />
              <Route path="farms/new" element={<RegisterFarmPage />} />
              <Route path="farms/:farmId" element={<FarmOverviewPage />} />
              <Route path="farms/:farmId/edit" element={<EditFarmPage />} />
              <Route path="settings/farm" element={<FarmSettingsPage />} />
              
              <Route path="fields" element={<FieldManagementPage />} />
              <Route path="fields/new" element={<AddFieldPage />} />
              <Route path="fields/:fieldId" element={<FieldDetailsPage />} />
              <Route path="fields/:fieldId/edit" element={<EditFieldPage />} />
              
              <Route path="farmers" element={<FarmerDirectoryPage />} />
              <Route path="farmers/:farmerId" element={<FarmerProfilePage />} />
              
              <Route path="jobs" element={<JobListPage />} />
              <Route path="jobs/new" element={<CreateJobPage />} />
              <Route path="jobs/:jobId" element={<JobDetailsPage />} />
              <Route path="applications" element={<ApplicationManagementPage />} />
              
              <Route path="assignments" element={<AssignmentManagementPage />} />
              <Route path="assignments/new" element={<CreateAssignmentPage />} />
              <Route path="assignments/history" element={<AssignmentHistoryPage />} />
              <Route path="assignments/:assignmentId" element={<AssignmentDetailsPage />} />
              
              <Route path="payments" element={<PaymentDashboardPage />} />
              <Route path="payments/ledger" element={<PaymentLedgerPage />} />
              <Route path="payments/new" element={<RecordPaymentPage />} />
              <Route path="payments/:paymentId" element={<PaymentDetailsPage />} />
              <Route path="payments/:paymentId/reverse" element={<ReversePaymentPage />} />
              
              <Route path="reviews" element={<ReviewManagementPage />} />
              <Route path="reviews/new" element={<CreateReviewPage />} />
              <Route path="reviews/:reviewId" element={<ReviewDetailsPage />} />
              
              <Route path="ai" element={<AIAnalysisDashboardPage />} />
              <Route path="ai/upload" element={<UploadCropImagePage />} />
              <Route path="ai/processing/:id" element={<AnalysisProcessingPage />} />
              <Route path="ai/results/:id" element={<AnalysisResultPage />} />
              <Route path="ai/history" element={<AnalysisHistoryPage />} />
              
              <Route path="monitoring" element={<SoilMonitoringDashboardPage />} />
              <Route path="monitoring/telemetry" element={<TelemetryHistoryPage />} />
              <Route path="monitoring/telemetry/:id" element={<TelemetryDetailsPage />} />
              
              <Route path="irrigation" element={<IrrigationDashboardPage />} />
              <Route path="irrigation/new" element={<CreateIrrigationPlanPage />} />
              <Route path="irrigation/history" element={<IrrigationHistoryPage />} />
              <Route path="irrigation/:planId" element={<IrrigationPlanDetailsPage />} />
              
              <Route path="activity" element={<ActivityDashboardPage />} />
              <Route path="activity/full" element={<FullHistoryPage />} />
              <Route path="activity/:activityId" element={<ActivityDetailsPage />} />
              
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings/security" element={<AccountSecurityPage />} />
              <Route path="settings/notifications" element={<NotificationSettingsPage />} />
            </Route>

            {/* Authenticated Farmer Dashboard Routes */}
            <Route
              path="/farmer"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/farmer/dashboard" replace />} />
              <Route path="dashboard" element={<FarmerDashboardPage />} />
              <Route path="fields" element={<FarmerFieldsPage />} />
              <Route path="fields/:fieldId" element={<FarmerFieldDetailsPage />} />
              <Route path="assignments" element={<FarmerAssignmentsPage />} />
              <Route path="payments" element={<FarmerPaymentsPage />} />
              <Route path="reviews" element={<FarmerReviewsPage />} />
              <Route path="applications" element={<MyApplicationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Fallback */}
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Router>
      </FarmProvider>
    </AuthProvider>
  );
}

export default App;
