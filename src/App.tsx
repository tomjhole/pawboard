import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { BusinessProvider } from '@/context/BusinessContext'
import RequireAuth from '@/components/auth/RequireAuth'
import RequireBusiness from '@/components/auth/RequireBusiness'
import AppShell from '@/components/layout/AppShell'
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
import OwnerDetailPage from '@/pages/OwnerDetailPage'
import PetDetailPage from '@/pages/PetDetailPage'
import BookingsPage from '@/pages/BookingsPage'
import BookingDetailPage from '@/pages/BookingDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BusinessProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<RequireBusiness />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Navigate to="/calendar" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/bookings" element={<BookingsPage />} />
                  <Route path="/bookings/:id" element={<BookingDetailPage />} />
                  <Route path="/owners" element={<OwnersPage />} />
                  <Route path="/owners/:id" element={<OwnerDetailPage />} />
                  <Route path="/pets/:id" element={<PetDetailPage />} />
                  <Route path="/pets" element={<PetsPage />} />
                  <Route path="/spaces" element={<SpacesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/business" element={<BusinessDetailsPage />} />
                  <Route path="/settings/branding" element={<BrandingPage />} />
                  <Route path="/settings/species" element={<SpeciesPage />} />
                  <Route path="/settings/accommodation" element={<AccommodationPage />} />
                  <Route path="/settings/accommodation/spaces" element={<BookableSpacesPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BusinessProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
