import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RouteTransitionLoader } from './components/common/RouteTransitionLoader';
import { PageSkeletonLoader } from './components/common/PageSkeletonLoader';

// Public Pages (Code-split with dynamic imports)
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegistrationPage = lazy(() => import('./pages/RegistrationPage').then(m => ({ default: m.RegistrationPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ExploreFarmsPage = lazy(() => import('./pages/ExploreFarmsPage').then(m => ({ default: m.ExploreFarmsPage })));
const JobsPage = lazy(() => import('./pages/JobsPage').then(m => ({ default: m.JobsPage })));
const AboutPage = lazy(() => import('./pages/PlaceholderPages').then(m => ({ default: m.AboutPage })));
const NotFoundPage = lazy(() => import('./pages/PlaceholderPages').then(m => ({ default: m.NotFoundPage })));

// Owner Dashboard Pages (Code-split)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MyFarmsPage = lazy(() => import('./pages/MyFarmsPage').then(m => ({ default: m.MyFarmsPage })));
const RegisterFarmPage = lazy(() => import('./pages/RegisterFarmPage').then(m => ({ default: m.RegisterFarmPage })));
const FarmOverviewPage = lazy(() => import('./pages/FarmOverviewPage').then(m => ({ default: m.FarmOverviewPage })));
const FarmSettingsPage = lazy(() => import('./pages/FarmSettingsPage').then(m => ({ default: m.FarmSettingsPage })));
const EditFarmPage = lazy(() => import('./pages/EditFarmPage').then(m => ({ default: m.EditFarmPage })));
const FieldManagementPage = lazy(() => import('./pages/FieldManagementPage').then(m => ({ default: m.FieldManagementPage })));
const AddFieldPage = lazy(() => import('./pages/AddFieldPage').then(m => ({ default: m.AddFieldPage })));
const FieldDetailsPage = lazy(() => import('./pages/FieldDetailsPage').then(m => ({ default: m.FieldDetailsPage })));
const EditFieldPage = lazy(() => import('./pages/EditFieldPage').then(m => ({ default: m.EditFieldPage })));
const FarmerDirectoryPage = lazy(() => import('./pages/FarmerDirectoryPage').then(m => ({ default: m.FarmerDirectoryPage })));
const FarmerProfilePage = lazy(() => import('./pages/FarmerProfilePage').then(m => ({ default: m.FarmerProfilePage })));
const JobListPage = lazy(() => import('./pages/JobListPage').then(m => ({ default: m.JobListPage })));
const CreateJobPage = lazy(() => import('./pages/CreateJobPage').then(m => ({ default: m.CreateJobPage })));
const JobDetailsPage = lazy(() => import('./pages/JobDetailsPage').then(m => ({ default: m.JobDetailsPage })));
const ApplicationManagementPage = lazy(() => import('./pages/ApplicationManagementPage').then(m => ({ default: m.ApplicationManagementPage })));
const AssignmentManagementPage = lazy(() => import('./pages/AssignmentManagementPage').then(m => ({ default: m.AssignmentManagementPage })));
const CreateAssignmentPage = lazy(() => import('./pages/CreateAssignmentPage').then(m => ({ default: m.CreateAssignmentPage })));
const AssignmentDetailsPage = lazy(() => import('./pages/AssignmentDetailsPage').then(m => ({ default: m.AssignmentDetailsPage })));
const AssignmentHistoryPage = lazy(() => import('./pages/AssignmentHistoryPage').then(m => ({ default: m.AssignmentHistoryPage })));
const PaymentDashboardPage = lazy(() => import('./pages/PaymentDashboardPage').then(m => ({ default: m.PaymentDashboardPage })));
const PaymentLedgerPage = lazy(() => import('./pages/PaymentLedgerPage').then(m => ({ default: m.PaymentLedgerPage })));
const RecordPaymentPage = lazy(() => import('./pages/RecordPaymentPage').then(m => ({ default: m.RecordPaymentPage })));
const PaymentDetailsPage = lazy(() => import('./pages/PaymentDetailsPage').then(m => ({ default: m.PaymentDetailsPage })));
const ReversePaymentPage = lazy(() => import('./pages/ReversePaymentPage').then(m => ({ default: m.ReversePaymentPage })));
const ReviewManagementPage = lazy(() => import('./pages/ReviewManagementPage').then(m => ({ default: m.ReviewManagementPage })));
const CreateReviewPage = lazy(() => import('./pages/CreateReviewPage').then(m => ({ default: m.CreateReviewPage })));
const ReviewDetailsPage = lazy(() => import('./pages/ReviewDetailsPage').then(m => ({ default: m.ReviewDetailsPage })));
const AIAnalysisDashboardPage = lazy(() => import('./pages/AIAnalysisDashboardPage').then(m => ({ default: m.AIAnalysisDashboardPage })));
const UploadCropImagePage = lazy(() => import('./pages/UploadCropImagePage').then(m => ({ default: m.UploadCropImagePage })));
const AnalysisProcessingPage = lazy(() => import('./pages/AnalysisProcessingPage').then(m => ({ default: m.AnalysisProcessingPage })));
const AnalysisResultPage = lazy(() => import('./pages/AnalysisResultPage').then(m => ({ default: m.AnalysisResultPage })));
const AnalysisHistoryPage = lazy(() => import('./pages/AnalysisHistoryPage').then(m => ({ default: m.AnalysisHistoryPage })));
const SoilMonitoringDashboardPage = lazy(() => import('./pages/SoilMonitoringDashboardPage').then(m => ({ default: m.SoilMonitoringDashboardPage })));
const TelemetryHistoryPage = lazy(() => import('./pages/TelemetryHistoryPage').then(m => ({ default: m.TelemetryHistoryPage })));
const TelemetryDetailsPage = lazy(() => import('./pages/TelemetryDetailsPage').then(m => ({ default: m.TelemetryDetailsPage })));
const IrrigationDashboardPage = lazy(() => import('./pages/IrrigationDashboardPage').then(m => ({ default: m.IrrigationDashboardPage })));
const CreateIrrigationPlanPage = lazy(() => import('./pages/CreateIrrigationPlanPage').then(m => ({ default: m.CreateIrrigationPlanPage })));
const IrrigationPlanDetailsPage = lazy(() => import('./pages/IrrigationPlanDetailsPage').then(m => ({ default: m.IrrigationPlanDetailsPage })));
const IrrigationHistoryPage = lazy(() => import('./pages/IrrigationHistoryPage').then(m => ({ default: m.IrrigationHistoryPage })));
const ActivityDashboardPage = lazy(() => import('./pages/ActivityDashboardPage').then(m => ({ default: m.ActivityDashboardPage })));
const FullHistoryPage = lazy(() => import('./pages/FullHistoryPage').then(m => ({ default: m.FullHistoryPage })));
const ActivityDetailsPage = lazy(() => import('./pages/ActivityDetailsPage').then(m => ({ default: m.ActivityDetailsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AccountSecurityPage = lazy(() => import('./pages/AccountSecurityPage').then(m => ({ default: m.AccountSecurityPage })));
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage').then(m => ({ default: m.NotificationSettingsPage })));

// Farmer Workspace Pages (Code-split)
const FarmerDashboardPage = lazy(() => import('./pages/FarmerDashboardPage').then(m => ({ default: m.FarmerDashboardPage })));
const FarmerFieldsPage = lazy(() => import('./pages/FarmerFieldsPage').then(m => ({ default: m.FarmerFieldsPage })));
const FarmerFieldDetailsPage = lazy(() => import('./pages/FarmerFieldDetailsPage').then(m => ({ default: m.FarmerFieldDetailsPage })));
const FarmerAssignmentsPage = lazy(() => import('./pages/FarmerAssignmentsPage').then(m => ({ default: m.FarmerAssignmentsPage })));
const FarmerPaymentsPage = lazy(() => import('./pages/FarmerPaymentsPage').then(m => ({ default: m.FarmerPaymentsPage })));
const FarmerReviewsPage = lazy(() => import('./pages/FarmerReviewsPage').then(m => ({ default: m.FarmerReviewsPage })));
const MyApplicationsPage = lazy(() => import('./pages/MyApplicationsPage').then(m => ({ default: m.MyApplicationsPage })));

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <FarmProvider>
            <Router>
          <RouteTransitionLoader />
          <Suspense fallback={<PageSkeletonLoader />}>
            <Routes>
              {/* Landing Page (dedicated full-bleed layout) */}
              <Route path="/" element={<LandingPage />} />

              {/* Public Routes */}
              <Route element={<PublicLayout />}>
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
          </Suspense>
        </Router>
      </FarmProvider>
    </AuthProvider>
  </LanguageProvider>
</ThemeProvider>
  );
}

export default App;
