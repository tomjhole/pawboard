import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { BusinessProvider } from '@/context/BusinessContext'
import { PortalProvider } from '@/context/PortalContext'
import RequireAuth from '@/components/auth/RequireAuth'
import RequireBusiness from '@/components/auth/RequireBusiness'
import AppShell from '@/components/layout/AppShell'
import PortalShell from '@/components/portal/PortalShell'
import PortalHomePage from '@/pages/portal/PortalHomePage'
import PortalPetsPage from '@/pages/portal/PortalPetsPage'
import PortalPetDetailPage from '@/pages/portal/PortalPetDetailPage'
import PortalRequestBookingPage from '@/pages/portal/PortalRequestBookingPage'
import PortalProfilePage from '@/pages/portal/PortalProfilePage'
import PortalUpdatesPage from '@/pages/portal/PortalUpdatesPage'
import PortalJoinPage from '@/pages/portal/PortalJoinPage'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import CalendarPage from '@/pages/CalendarPage'
import OwnersPage from '@/pages/OwnersPage'
import PetsPage from '@/pages/PetsPage'
import SpacesPage from '@/pages/SpacesPage'
import SettingsPage from '@/pages/SettingsPage'
import BusinessDetailsPage from '@/pages/settings/BusinessDetailsPage'
import BrandingPage from '@/pages/settings/BrandingPage'
import SpeciesPage from '@/pages/settings/SpeciesPage'
import AccommodationPage from '@/pages/settings/AccommodationPage'
import BookableSpacesPage from '@/pages/settings/BookableSpacesPage'
import VaccinationTypesPage from '@/pages/settings/VaccinationTypesPage'
import PricingPage from '@/pages/settings/PricingPage'
import PortalSettingsPage from '@/pages/settings/PortalSettingsPage'
import PaymentsSettingsPage from '@/pages/settings/PaymentsSettingsPage'
import StayJournalSettingsPage from '@/pages/settings/StayJournalSettingsPage'
import PlanPage from '@/pages/settings/PlanPage'
import StaffPage from '@/pages/settings/StaffPage'
import RequireRole from '@/components/auth/RequireRole'
import OnboardingPage from '@/pages/OnboardingPage'
import JoinPage from '@/pages/JoinPage'
import AdminPage from '@/pages/AdminPage'
import OwnerDetailPage from '@/pages/OwnerDetailPage'
import PetDetailPage from '@/pages/PetDetailPage'
import BookingsPage from '@/pages/BookingsPage'
import BookingDetailPage from '@/pages/BookingDetailPage'
import OperationsPage from '@/pages/OperationsPage'
import ReportsPage from '@/pages/reports/ReportsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BusinessProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Public — the page handles its own sign-up / sign-in with the invited email */}
            <Route path="/portal/join" element={<PortalJoinPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/join"       element={<JoinPage />} />
              <Route path="/admin"      element={<AdminPage />} />
            </Route>

            {/* Owner portal — separate authenticated surface for linked pet owners */}
            <Route element={<RequireAuth />}>
              <Route path="/portal" element={<PortalProvider><PortalShell /></PortalProvider>}>
                <Route index             element={<PortalHomePage />} />
                <Route path="pets"        element={<PortalPetsPage />} />
                <Route path="pets/:id"    element={<PortalPetDetailPage />} />
                <Route path="updates"     element={<PortalUpdatesPage />} />
                <Route path="request"     element={<PortalRequestBookingPage />} />
                <Route path="profile"     element={<PortalProfilePage />} />
              </Route>
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<RequireBusiness />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Navigate to="/calendar" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/operations" element={<OperationsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/bookings" element={<BookingsPage />} />
                  <Route path="/bookings/:id" element={<BookingDetailPage />} />
                  <Route path="/owners" element={<OwnersPage />} />
                  <Route path="/owners/:id" element={<OwnerDetailPage />} />
                  <Route path="/pets/:id" element={<PetDetailPage />} />
                  <Route path="/pets" element={<PetsPage />} />
                  <Route path="/spaces" element={<SpacesPage />} />
                  {/* Settings — owner or manager only */}
                  <Route element={<RequireRole allowed={['owner', 'manager']} />}>
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/business" element={<BusinessDetailsPage />} />
                    <Route path="/settings/branding" element={<BrandingPage />} />
                    <Route path="/settings/species" element={<SpeciesPage />} />
                    <Route path="/settings/accommodation" element={<AccommodationPage />} />
                    <Route path="/settings/accommodation/spaces" element={<BookableSpacesPage />} />
                    <Route path="/settings/vaccination-types" element={<VaccinationTypesPage />} />
                    <Route path="/settings/pricing" element={<PricingPage />} />
                    <Route path="/settings/portal"  element={<PortalSettingsPage />} />
                    <Route path="/settings/payments" element={<PaymentsSettingsPage />} />
                    <Route path="/settings/journal"  element={<StayJournalSettingsPage />} />
                    <Route path="/settings/plan"    element={<PlanPage />} />
                  </Route>
                  {/* Staff management — owner only */}
                  <Route element={<RequireRole allowed={['owner']} />}>
                    <Route path="/settings/staff" element={<StaffPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Routes>
        </BusinessProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
