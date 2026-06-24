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
          created_at: string
          currency: string
          id: string
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
          created_at?: string
          currency?: string
          id?: string
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
          created_at?: string
          currency?: string
          id?: string
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
      get_current_business_id: { Args: never; Returns: string }
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
