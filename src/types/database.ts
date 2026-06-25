export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accommodation_area_species: {
        Row: {
          area_id: string
          business_id: string
          id: string
          species_id: string
        }
        Insert: {
          area_id: string
          business_id: string
          id?: string
          species_id: string
        }
        Update: {
          area_id?: string
          business_id?: string
          id?: string
          species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_area_species_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "accommodation_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_area_species_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_area_species_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_areas: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_areas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_space_species: {
        Row: {
          business_id: string
          id: string
          space_id: string
          species_id: string
        }
        Insert: {
          business_id: string
          id?: string
          space_id: string
          species_id: string
        }
        Update: {
          business_id?: string
          id?: string
          space_id?: string
          species_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_space_species_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_space_species_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "accommodation_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_space_species_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_space_types: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_space_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodation_spaces: {
        Row: {
          allow_mixed_species: boolean
          allowed_pet_sizes: Database["public"]["Enums"]["pet_size"][] | null
          area_id: string
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          max_pets: number
          name: string
          notes: string | null
          requires_staff_approval: boolean
          same_household_only: boolean
          sort_order: number
          space_type_id: string | null
          updated_at: string
        }
        Insert: {
          allow_mixed_species?: boolean
          allowed_pet_sizes?: Database["public"]["Enums"]["pet_size"][] | null
          area_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_pets?: number
          name: string
          notes?: string | null
          requires_staff_approval?: boolean
          same_household_only?: boolean
          sort_order?: number
          space_type_id?: string | null
          updated_at?: string
        }
        Update: {
          allow_mixed_species?: boolean
          allowed_pet_sizes?: Database["public"]["Enums"]["pet_size"][] | null
          area_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          max_pets?: number
          name?: string
          notes?: string | null
          requires_staff_approval?: boolean
          same_household_only?: boolean
          sort_order?: number
          space_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_spaces_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "accommodation_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_spaces_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_spaces_space_type_id_fkey"
            columns: ["space_type_id"]
            isOneToOne: false
            referencedRelation: "accommodation_space_types"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action:      string
          actor_label: string | null
          after:       Json | null
          before:      Json | null
          business_id: string
          created_at:  string
          entity_id:   string
          entity_type: string
          id:          string
          ip_address:  unknown
          meta:        Json | null
          payload:     Json | null
          user_id:     string | null
        }
        Insert: {
          action:       string
          actor_label?: string | null
          after?:       Json | null
          before?:      Json | null
          business_id:  string
          created_at?:  string
          entity_id:    string
          entity_type:  string
          id?:          string
          ip_address?:  unknown
          meta?:        Json | null
          payload?:     Json | null
          user_id?:     string | null
        }
        Update: {
          action?:      string
          actor_label?: string | null
          after?:       Json | null
          before?:      Json | null
          business_id?: string
          created_at?:  string
          entity_id?:   string
          entity_type?: string
          id?:          string
          ip_address?:  unknown
          meta?:        Json | null
          payload?:     Json | null
          user_id?:     string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_pets: {
        Row: {
          booking_id: string
          business_id: string
          created_at: string
          feeding_instructions: string | null
          feeds_per_day: number | null
          id: string
          medication_notes: string | null
          notes: string | null
          pet_id: string
        }
        Insert: {
          booking_id: string
          business_id: string
          created_at?: string
          feeding_instructions?: string | null
          feeds_per_day?: number | null
          id?: string
          medication_notes?: string | null
          notes?: string | null
          pet_id: string
        }
        Update: {
          booking_id?: string
          business_id?: string
          created_at?: string
          feeding_instructions?: string | null
          feeds_per_day?: number | null
          id?: string
          medication_notes?: string | null
          notes?: string | null
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_pets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_pets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_pets_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_space_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          booking_pet_id: string
          business_id: string
          end_date: string
          id: string
          notes: string | null
          space_id: string
          start_date: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          booking_pet_id: string
          business_id: string
          end_date: string
          id?: string
          notes?: string | null
          space_id: string
          start_date: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          booking_pet_id?: string
          business_id?: string
          end_date?: string
          id?: string
          notes?: string | null
          space_id?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_space_assignments_booking_pet_id_fkey"
            columns: ["booking_pet_id"]
            isOneToOne: false
            referencedRelation: "booking_pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_space_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_space_assignments_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "accommodation_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          balance_paid: boolean
          balance_paid_at: string | null
          business_id: string
          checked_in_at: string | null
          checked_in_by: string | null
          checked_out_at: string | null
          checked_out_by: string | null
          created_at: string
          created_by: string | null
          deposit_amount: number | null
          deposit_paid: boolean
          deposit_paid_at: string | null
          end_date: string
          id: string
          notes: string | null
          owner_id: string
          source: string
          start_date: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          balance_paid?: boolean
          balance_paid_at?: string | null
          business_id: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          end_date: string
          id?: string
          notes?: string | null
          owner_id: string
          source?: string
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          balance_paid?: boolean
          balance_paid_at?: string | null
          business_id?: string
          checked_in_at?: string | null
          checked_in_by?: string | null
          checked_out_at?: string | null
          checked_out_by?: string | null
          created_at?: string
          created_by?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean
          deposit_paid_at?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          owner_id?: string
          source?: string
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          allow_same_day_bookings: boolean
          booking_max_advance_days: number
          booking_min_notice_hours: number
          business_id: string
          checkin_time: string
          checkout_time: string
          bank_transfer_details: string | null
          created_at: string
          currency: string
          deposit_type: string
          deposit_value: number
          id: string
          payments_enabled: boolean
          require_balance_before_checkout: boolean
          stripe_enabled: boolean
          stripe_test_mode: boolean
          stay_journal_enabled: boolean
          stay_journal_owner_visible: boolean
          setup_completed_at: string | null
          email_enabled: boolean
          notify_booking_changes: boolean
          notify_cancellation: boolean
          notify_payment_receipt: boolean
          notify_booking_request: boolean
          notify_arrival_reminder: boolean
          notify_vaccination_reminder: boolean
          vaccination_reminder_days: number
          portal_allow_booking_requests: boolean
          portal_allow_documents: boolean
          portal_allow_pet_edits: boolean
          portal_enabled: boolean
          reminder_days_before: number
          require_vaccination_proof: boolean
          require_vet_details: boolean
          send_booking_confirmation: boolean
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_same_day_bookings?: boolean
          booking_max_advance_days?: number
          booking_min_notice_hours?: number
          business_id: string
          checkin_time?: string
          checkout_time?: string
          bank_transfer_details?: string | null
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          id?: string
          payments_enabled?: boolean
          require_balance_before_checkout?: boolean
          stripe_enabled?: boolean
          stripe_test_mode?: boolean
          stay_journal_enabled?: boolean
          stay_journal_owner_visible?: boolean
          setup_completed_at?: string | null
          email_enabled?: boolean
          notify_booking_changes?: boolean
          notify_cancellation?: boolean
          notify_payment_receipt?: boolean
          notify_booking_request?: boolean
          notify_arrival_reminder?: boolean
          notify_vaccination_reminder?: boolean
          vaccination_reminder_days?: number
          portal_allow_booking_requests?: boolean
          portal_allow_documents?: boolean
          portal_allow_pet_edits?: boolean
          portal_enabled?: boolean
          reminder_days_before?: number
          require_vaccination_proof?: boolean
          require_vet_details?: boolean
          send_booking_confirmation?: boolean
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_same_day_bookings?: boolean
          booking_max_advance_days?: number
          booking_min_notice_hours?: number
          business_id?: string
          checkin_time?: string
          checkout_time?: string
          bank_transfer_details?: string | null
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          id?: string
          payments_enabled?: boolean
          require_balance_before_checkout?: boolean
          stripe_enabled?: boolean
          stripe_test_mode?: boolean
          stay_journal_enabled?: boolean
          stay_journal_owner_visible?: boolean
          setup_completed_at?: string | null
          email_enabled?: boolean
          notify_booking_changes?: boolean
          notify_cancellation?: boolean
          notify_payment_receipt?: boolean
          notify_booking_request?: boolean
          notify_arrival_reminder?: boolean
          notify_vaccination_reminder?: boolean
          vaccination_reminder_days?: number
          portal_allow_booking_requests?: boolean
          portal_allow_documents?: boolean
          portal_allow_pet_edits?: boolean
          portal_enabled?: boolean
          reminder_days_before?: number
          require_vaccination_proof?: boolean
          require_vet_details?: boolean
          send_booking_confirmation?: boolean
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_theme: {
        Row: {
          accent_colour: string
          business_id: string
          created_at: string
          id: string
          logo_url: string | null
          primary_colour: string
          secondary_colour: string
          updated_at: string
        }
        Insert: {
          accent_colour?: string
          business_id: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_colour?: string
          secondary_colour?: string
          updated_at?: string
        }
        Update: {
          accent_colour?: string
          business_id?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          primary_colour?: string
          secondary_colour?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_theme_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          licence_number: string | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          slug: string
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          licence_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          slug: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          licence_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          slug?: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      owners: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          emergency_contact_can_authorise_vet: boolean
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string
          phone_secondary: string | null
          portal_user_id: string | null
          postcode: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_contact_can_authorise_vet?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone: string
          phone_secondary?: string | null
          portal_user_id?: string | null
          postcode?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          emergency_contact_can_authorise_vet?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string
          phone_secondary?: string | null
          portal_user_id?: string | null
          postcode?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          behaviour_notes: string | null
          breed: string | null
          business_id: string
          can_mix_with_others: boolean
          colour_markings: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          feeding_instructions: string | null
          feeds_per_day: number
          flea_treatment_date: string | null
          flea_treatment_product: string | null
          id: string
          insurance_policy_number: string | null
          insurance_provider: string | null
          is_active: boolean
          is_neutered: boolean | null
          medical_notes: string | null
          microchip_number: string | null
          name: string
          owner_id: string
          photo_url: string | null
          sex: Database["public"]["Enums"]["pet_sex"]
          size: Database["public"]["Enums"]["pet_size"] | null
          species_id: string
          updated_at: string
          vet_address: string | null
          vet_name: string | null
          vet_phone: string | null
          vet_practice_name: string | null
          worming_treatment_date: string | null
          worming_treatment_product: string | null
        }
        Insert: {
          behaviour_notes?: string | null
          breed?: string | null
          business_id: string
          can_mix_with_others?: boolean
          colour_markings?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          feeding_instructions?: string | null
          feeds_per_day?: number
          flea_treatment_date?: string | null
          flea_treatment_product?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          is_neutered?: boolean | null
          medical_notes?: string | null
          microchip_number?: string | null
          name: string
          owner_id: string
          photo_url?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          size?: Database["public"]["Enums"]["pet_size"] | null
          species_id: string
          updated_at?: string
          vet_address?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          vet_practice_name?: string | null
          worming_treatment_date?: string | null
          worming_treatment_product?: string | null
        }
        Update: {
          behaviour_notes?: string | null
          breed?: string | null
          business_id?: string
          can_mix_with_others?: boolean
          colour_markings?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          feeding_instructions?: string | null
          feeds_per_day?: number
          flea_treatment_date?: string | null
          flea_treatment_product?: string | null
          id?: string
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          is_active?: boolean
          is_neutered?: boolean | null
          medical_notes?: string | null
          microchip_number?: string | null
          name?: string
          owner_id?: string
          photo_url?: string | null
          sex?: Database["public"]["Enums"]["pet_sex"]
          size?: Database["public"]["Enums"]["pet_size"] | null
          species_id?: string
          updated_at?: string
          vet_address?: string | null
          vet_name?: string | null
          vet_phone?: string | null
          vet_practice_name?: string | null
          worming_treatment_date?: string | null
          worming_treatment_product?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pets_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          business_id: string | null
          colour: string | null
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_system_default: boolean
          name: string
          plural_name: string
          sort_order: number
        }
        Insert: {
          business_id?: string | null
          colour?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          name: string
          plural_name: string
          sort_order?: number
        }
        Update: {
          business_id?: string | null
          colour?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_system_default?: boolean
          name?: string
          plural_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "species_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stay_journal_entries: {
        Row: {
          id:           string
          business_id:  string
          booking_id:   string
          entry_type:   string
          body:         string | null
          photo_url:    string | null
          author_label: string | null
          created_by:   string | null
          created_at:   string
          updated_at:   string
        }
        Insert: {
          id?:           string
          business_id:   string
          booking_id:    string
          entry_type?:   string
          body?:         string | null
          photo_url?:    string | null
          author_label?: string | null
          created_by?:   string | null
          created_at?:   string
          updated_at?:   string
        }
        Update: {
          id?:           string
          business_id?:  string
          booking_id?:   string
          entry_type?:   string
          body?:         string | null
          photo_url?:    string | null
          author_label?: string | null
          created_by?:   string | null
          created_at?:   string
          updated_at?:   string
        }
        Relationships: [
          {
            foreignKeyName: "stay_journal_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stay_journal_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          id:           string
          business_id:  string
          to_email:     string
          type:         string
          subject:      string | null
          related_type: string | null
          related_id:   string | null
          status:       string
          provider_id:  string | null
          error:        string | null
          created_at:   string
          sent_at:      string | null
        }
        Insert: {
          id?:           string
          business_id:   string
          to_email:      string
          type:          string
          subject?:      string | null
          related_type?: string | null
          related_id?:   string | null
          status?:       string
          provider_id?:  string | null
          error?:        string | null
          created_at?:   string
          sent_at?:      string | null
        }
        Update: {
          id?:           string
          business_id?:  string
          to_email?:     string
          type?:         string
          subject?:      string | null
          related_type?: string | null
          related_id?:   string | null
          status?:       string
          provider_id?:  string | null
          error?:        string | null
          created_at?:   string
          sent_at?:      string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id:          string
          business_id: string
          booking_id:  string
          amount:      number
          method:      string
          kind:        string
          status:      string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id:   string | null
          notes:       string | null
          paid_at:     string | null
          created_by:  string | null
          created_at:  string
          updated_at:  string
        }
        Insert: {
          id?:          string
          business_id:  string
          booking_id:   string
          amount:       number
          method:       string
          kind?:        string
          status?:      string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?:   string | null
          notes?:       string | null
          paid_at?:     string | null
          created_by?:  string | null
          created_at?:  string
          updated_at?:  string
        }
        Update: {
          id?:          string
          business_id?: string
          booking_id?:  string
          amount?:      number
          method?:      string
          kind?:        string
          status?:      string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?:   string | null
          notes?:       string | null
          paid_at?:     string | null
          created_by?:  string | null
          created_at?:  string
          updated_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_portal_invites: {
        Row: {
          id:          string
          business_id: string
          owner_id:    string
          email:       string
          token:       string
          invited_by:  string | null
          created_at:  string
          expires_at:  string
          accepted_at: string | null
        }
        Insert: {
          id?:          string
          business_id:  string
          owner_id:     string
          email:        string
          token?:       string
          invited_by?:  string | null
          created_at?:  string
          expires_at?:  string
          accepted_at?: string | null
        }
        Update: {
          id?:          string
          business_id?: string
          owner_id?:    string
          email?:       string
          token?:       string
          invited_by?:  string | null
          created_at?:  string
          expires_at?:  string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_portal_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_portal_invites_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          id:          string
          business_id: string
          email:       string
          role:        Database["public"]["Enums"]["staff_role"]
          invited_by:  string | null
          token:       string
          created_at:  string
          expires_at:  string
          accepted_at: string | null
        }
        Insert: {
          id?:         string
          business_id: string
          email:       string
          role?:       Database["public"]["Enums"]["staff_role"]
          invited_by?: string | null
          token?:      string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?:         string
          business_id?: string
          email?:      string
          role?:       Database["public"]["Enums"]["staff_role"]
          invited_by?: string | null
          token?:      string
          created_at?: string
          expires_at?: string
          accepted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_users: {
        Row: {
          business_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          invited_at: string | null
          is_active: boolean
          last_name: string
          last_seen_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          first_name: string
          id: string
          invited_at?: string | null
          is_active?: boolean
          last_name: string
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          last_name?: string
          last_seen_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_extras_catalog: {
        Row: {
          id:               string
          business_id:      string
          name:             string
          description:      string | null
          unit_price:       number
          charge_frequency: string
          is_active:        boolean
          sort_order:       number
          created_at:       string
        }
        Insert: {
          id?:               string
          business_id:       string
          name:              string
          description?:      string | null
          unit_price:        number
          charge_frequency?: string
          is_active?:        boolean
          sort_order?:       number
          created_at?:       string
        }
        Update: {
          id?:               string
          business_id?:      string
          name?:             string
          description?:      string | null
          unit_price?:       number
          charge_frequency?: string
          is_active?:        boolean
          sort_order?:       number
          created_at?:       string
        }
        Relationships: [
          {
            foreignKeyName: "booking_extras_catalog_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_line_items: {
        Row: {
          id:          string
          booking_id:  string
          description: string
          quantity:    number
          unit_price:  number
          total_price: number
          source:      string
          sort_order:  number
          created_at:  string
        }
        Insert: {
          id?:          string
          booking_id:   string
          description:  string
          quantity?:    number
          unit_price:   number
          total_price:  number
          source?:      string
          sort_order?:  number
          created_at?:  string
        }
        Update: {
          id?:          string
          booking_id?:  string
          description?: string
          quantity?:    number
          unit_price?:  number
          total_price?: number
          source?:      string
          sort_order?:  number
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: "booking_line_items_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_care_log: {
        Row: {
          id:             string
          business_id:    string
          booking_pet_id: string
          log_date:       string
          care_type:      string
          completed_at:   string
          completed_by:   string | null
        }
        Insert: {
          id?:             string
          business_id:     string
          booking_pet_id:  string
          log_date:        string
          care_type:       string
          completed_at?:   string
          completed_by?:   string | null
        }
        Update: {
          id?:             string
          business_id?:    string
          booking_pet_id?: string
          log_date?:       string
          care_type?:      string
          completed_at?:   string
          completed_by?:   string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_care_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_care_log_booking_pet_id_fkey"
            columns: ["booking_pet_id"]
            isOneToOne: false
            referencedRelation: "booking_pets"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          id:          string
          business_id: string
          log_date:    string
          note_text:   string
          updated_at:  string
        }
        Insert: {
          id?:          string
          business_id:  string
          log_date:     string
          note_text?:   string
          updated_at?:  string
        }
        Update: {
          id?:          string
          business_id?: string
          log_date?:    string
          note_text?:   string
          updated_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_pricing: {
        Row: {
          plan_id:       string
          price_monthly: number
          currency:      string
          is_active:     boolean
          updated_at:    string
        }
        Insert: {
          plan_id:        string
          price_monthly:  number
          currency?:      string
          is_active?:     boolean
          updated_at?:    string
        }
        Update: {
          plan_id?:       string
          price_monthly?: number
          currency?:      string
          is_active?:     boolean
          updated_at?:    string
        }
        Relationships: []
      }
      pricing_rates: {
        Row: {
          id:          string
          business_id: string
          area_id:     string | null
          species_id:  string | null
          pet_size:    string | null
          unit_price:  number
          label:       string | null
          sort_order:  number
          is_active:   boolean
          created_at:  string
        }
        Insert: {
          id?:          string
          business_id:  string
          area_id?:     string | null
          species_id?:  string | null
          pet_size?:    string | null
          unit_price:   number
          label?:       string | null
          sort_order?:  number
          is_active?:   boolean
          created_at?:  string
        }
        Update: {
          id?:          string
          business_id?: string
          area_id?:     string | null
          species_id?:  string | null
          pet_size?:    string | null
          unit_price?:  number
          label?:       string | null
          sort_order?:  number
          is_active?:   boolean
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_settings: {
        Row: {
          id:                 string
          business_id:        string
          calculation_method: string
          currency_code:      string
          created_at:         string
        }
        Insert: {
          id?:                 string
          business_id:         string
          calculation_method?: string
          currency_code?:      string
          created_at?:         string
        }
        Update: {
          id?:                  string
          business_id?:         string
          calculation_method?:  string
          currency_code?:       string
          created_at?:          string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_sharing_rules: {
        Row: {
          id:             string
          business_id:    string
          animal_number:  number
          is_nth_onwards: boolean
          discount_type:  string
          value:          number
          sort_order:     number
          created_at:     string
        }
        Insert: {
          id?:             string
          business_id:     string
          animal_number:   number
          is_nth_onwards?: boolean
          discount_type:   string
          value:           number
          sort_order?:     number
          created_at?:     string
        }
        Update: {
          id?:             string
          business_id?:    string
          animal_number?:  number
          is_nth_onwards?: boolean
          discount_type?:  string
          value?:          number
          sort_order?:     number
          created_at?:     string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_sharing_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccination_types: {
        Row: {
          id:          string
          business_id: string
          name:        string
          species_id:  string | null
          is_critical: boolean
          sort_order:  number
          is_active:   boolean
        }
        Insert: {
          id?:          string
          business_id:  string
          name:         string
          species_id?:  string | null
          is_critical?: boolean
          sort_order?:  number
          is_active?:   boolean
        }
        Update: {
          id?:          string
          business_id?: string
          name?:        string
          species_id?:  string | null
          is_critical?: boolean
          sort_order?:  number
          is_active?:   boolean
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_types_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_date: string | null
          business_id: string
          created_at: string
          created_by: string | null
          document_url: string | null
          expiry_date: string | null
          id: string
          is_rejected: boolean
          is_verified: boolean
          pet_id: string
          rejection_reason: string | null
          updated_at: string
          vaccination_type: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          administered_date?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          is_rejected?: boolean
          is_verified?: boolean
          pet_id: string
          rejection_reason?: string | null
          updated_at?: string
          vaccination_type: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          administered_date?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          is_rejected?: boolean
          is_verified?: boolean
          pet_id?: string
          rejection_reason?: string | null
          updated_at?: string
          vaccination_type?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_business_id:       { Args: Record<PropertyKey, never>; Returns: string }
      is_platform_admin:             { Args: Record<PropertyKey, never>; Returns: boolean }
      get_admin_view_business_id:    { Args: Record<PropertyKey, never>; Returns: string | null }
      get_portal_owner_id:           { Args: Record<PropertyKey, never>; Returns: string | null }
      set_admin_view: {
        Args: { target_business_id: string | null }
        Returns: undefined
      }
      get_all_businesses_admin: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["businesses"]["Row"][]
      }
      create_business_and_owner: {
        Args: { p_name: string; p_slug: string; p_first_name: string; p_last_name: string; p_email: string; p_phone?: string | null }
        Returns: string
      }
      list_platform_admins: {
        Args: Record<PropertyKey, never>
        Returns: { user_id: string; email: string; created_at: string }[]
      }
      grant_platform_admin_by_email: { Args: { p_email: string }; Returns: undefined }
      revoke_platform_admin:         { Args: { p_user_id: string }; Returns: undefined }
      create_business_admin:         { Args: { p_name: string; p_slug: string }; Returns: string }
      delete_business_admin:         { Args: { p_business_id: string }; Returns: undefined }
      set_business_plan_admin:       { Args: { p_business_id: string; p_plan: string }; Returns: undefined }
      update_plan_pricing: {
        Args: { p_plan_id: string; p_price: number; p_currency?: string }
        Returns: undefined
      }
      create_staff_invite: {
        Args: { p_email: string; p_role: Database["public"]["Enums"]["staff_role"] }
        Returns: string
      }
      get_invite_by_token: {
        Args: { p_token: string }
        Returns: { business_name: string; email: string; role: Database["public"]["Enums"]["staff_role"]; expires_at: string; is_valid: boolean }[]
      }
      accept_staff_invite: {
        Args: { p_token: string; p_first_name: string; p_last_name: string }
        Returns: undefined
      }
      update_staff_role: {
        Args: { p_staff_id: string; p_new_role: Database["public"]["Enums"]["staff_role"] }
        Returns: undefined
      }
      set_staff_active:              { Args: { p_staff_id: string; p_active: boolean }; Returns: undefined }
      portal_can:                    { Args: { p_feature: string }; Returns: boolean }
      create_owner_portal_invite:    { Args: { p_owner_id: string }; Returns: string }
      accept_owner_portal_invite:    { Args: { p_token: string }; Returns: undefined }
      get_owner_portal_invite_by_token: {
        Args: { p_token: string }
        Returns: { owner_id: string; business_id: string; email: string; is_valid: boolean }[]
      }
    }
    Enums: {
      booking_status:
        | "enquiry"
        | "confirmed"
        | "details_outstanding"
        | "ready"
        | "checked_in"
        | "due_out"
        | "checked_out"
        | "cancelled"
        | "waiting_list"
      pet_sex: "male" | "female" | "unknown"
      pet_size: "toy" | "small" | "medium" | "large" | "giant"
      staff_role: "owner" | "manager" | "staff" | "read_only"
      subscription_plan: "diary" | "professional" | "premium"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: [
        "enquiry",
        "confirmed",
        "details_outstanding",
        "ready",
        "checked_in",
        "due_out",
        "checked_out",
        "cancelled",
        "waiting_list",
      ],
      pet_sex: ["male", "female", "unknown"],
      pet_size: ["toy", "small", "medium", "large", "giant"],
      staff_role: ["owner", "manager", "staff", "read_only"],
      subscription_plan: ["diary", "professional", "premium"],
    },
  },
} as const
