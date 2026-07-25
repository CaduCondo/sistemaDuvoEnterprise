 
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
      admin_fee_exempt_locations: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_fee_exempt_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_fee_exempt_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
        ]
      }
      auth_user_mapping: {
        Row: {
          auth_user_id: string
          created_at: string | null
          email: string
          id: string
          system_user_id: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id: string
          created_at?: string | null
          email: string
          id?: string
          system_user_id: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string
          created_at?: string | null
          email?: string
          id?: string
          system_user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_user_mapping_system_user_id_fkey"
            columns: ["system_user_id"]
            isOneToOne: true
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_fee_exemptions: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_fee_exemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_fee_exemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "broker_fee_exemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      configs: {
        Row: {
          address: string | null
          admin_fee_percentage: number
          broker_fee_percentage: number | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          interest_rate_percentage: number | null
          late_fee_percentage: number | null
          management_fee_percentage: number | null
          phone: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          admin_fee_percentage?: number
          broker_fee_percentage?: number | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interest_rate_percentage?: number | null
          late_fee_percentage?: number | null
          management_fee_percentage?: number | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          admin_fee_percentage?: number
          broker_fee_percentage?: number | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interest_rate_percentage?: number | null
          late_fee_percentage?: number | null
          management_fee_percentage?: number | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      deposit_installments: {
        Row: {
          amount: number
          attachments: string[] | null
          created_at: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          installment_number: number
          installment_total: number
          interest_amount: number | null
          internal_commission: number | null
          notes: string | null
          paid_amount: number | null
          partner_commission: number | null
          payment_code: string | null
          payment_date: string | null
          payment_location: string | null
          payment_method: string | null
          penalty_amount: number | null
          pix_code: string | null
          receipt_url: string | null
          reference_month: number | null
          reference_year: number | null
          rental_id: string
          status: string | null
          total_installments: number
          updated_at: string | null
        }
        Insert: {
          amount: number
          attachments?: string[] | null
          created_at?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          installment_number: number
          installment_total: number
          interest_amount?: number | null
          internal_commission?: number | null
          notes?: string | null
          paid_amount?: number | null
          partner_commission?: number | null
          payment_code?: string | null
          payment_date?: string | null
          payment_location?: string | null
          payment_method?: string | null
          penalty_amount?: number | null
          pix_code?: string | null
          receipt_url?: string | null
          reference_month?: number | null
          reference_year?: number | null
          rental_id: string
          status?: string | null
          total_installments?: number
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachments?: string[] | null
          created_at?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          installment_number?: number
          installment_total?: number
          interest_amount?: number | null
          internal_commission?: number | null
          notes?: string | null
          paid_amount?: number | null
          partner_commission?: number | null
          payment_code?: string | null
          payment_date?: string | null
          payment_location?: string | null
          payment_method?: string | null
          penalty_amount?: number | null
          pix_code?: string | null
          receipt_url?: string | null
          reference_month?: number | null
          reference_year?: number | null
          rental_id?: string
          status?: string | null
          total_installments?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_installments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      location_expenses: {
        Row: {
          amount: number
          attachments: string[] | null
          created_at: string | null
          description: string
          expense_type: string
          id: string
          location_id: string
          paid: boolean | null
          payment_date: string | null
          reference_month: number
          reference_year: number
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          attachments?: string[] | null
          created_at?: string | null
          description: string
          expense_type?: string
          id?: string
          location_id: string
          paid?: boolean | null
          payment_date?: string | null
          reference_month: number
          reference_year: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          attachments?: string[] | null
          created_at?: string | null
          description?: string
          expense_type?: string
          id?: string
          location_id?: string
          paid?: boolean | null
          payment_date?: string | null
          reference_month?: number
          reference_year?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string
          complement: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          neighborhood: string | null
          number: string | null
          state: string
          street: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          neighborhood?: string | null
          number?: string | null
          state: string
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          neighborhood?: string | null
          number?: string | null
          state?: string
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      management_fee_exempt_locations: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_fee_exempt_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_fee_exempt_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_fee: number | null
          attachments: Json | null
          breakdown: Json | null
          created_at: string | null
          discount_amount: number | null
          due_date: string
          expected_amount: number
          id: string
          installment: number | null
          interest: number | null
          interest_waived: boolean | null
          is_paid: boolean | null
          late_fee: number | null
          late_fee_waived: boolean | null
          notes: string | null
          paid_amount: number | null
          partial_payments: Json | null
          payment_code: string | null
          payment_date: string | null
          payment_location: string | null
          payment_method: string | null
          payment_time: string | null
          pix_code: string | null
          pix_code_type: string | null
          reference_month: string
          reference_year: string
          rental_id: string
          status: string
          total_installments: number | null
          updated_at: string | null
        }
        Insert: {
          admin_fee?: number | null
          attachments?: Json | null
          breakdown?: Json | null
          created_at?: string | null
          discount_amount?: number | null
          due_date: string
          expected_amount: number
          id?: string
          installment?: number | null
          interest?: number | null
          interest_waived?: boolean | null
          is_paid?: boolean | null
          late_fee?: number | null
          late_fee_waived?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          partial_payments?: Json | null
          payment_code?: string | null
          payment_date?: string | null
          payment_location?: string | null
          payment_method?: string | null
          payment_time?: string | null
          pix_code?: string | null
          pix_code_type?: string | null
          reference_month: string
          reference_year: string
          rental_id: string
          status: string
          total_installments?: number | null
          updated_at?: string | null
        }
        Update: {
          admin_fee?: number | null
          attachments?: Json | null
          breakdown?: Json | null
          created_at?: string | null
          discount_amount?: number | null
          due_date?: string
          expected_amount?: number
          id?: string
          installment?: number | null
          interest?: number | null
          interest_waived?: boolean | null
          is_paid?: boolean | null
          late_fee?: number | null
          late_fee_waived?: boolean | null
          notes?: string | null
          paid_amount?: number | null
          partial_payments?: Json | null
          payment_code?: string | null
          payment_date?: string | null
          payment_location?: string | null
          payment_method?: string | null
          payment_time?: string | null
          pix_code?: string | null
          pix_code_type?: string | null
          reference_month?: string
          reference_year?: string
          rental_id?: string
          status?: string
          total_installments?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          accepts_pets: boolean | null
          area: number | null
          bathrooms: number | null
          complement: string | null
          created_at: string | null
          description: string | null
          has_furniture: boolean | null
          has_garage: boolean | null
          id: string
          image_count: number
          images: Json | null
          location_id: string
          property_identifier: string | null
          rooms: number | null
          status: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          accepts_pets?: boolean | null
          area?: number | null
          bathrooms?: number | null
          complement?: string | null
          created_at?: string | null
          description?: string | null
          has_furniture?: boolean | null
          has_garage?: boolean | null
          id?: string
          image_count?: number
          images?: Json | null
          location_id: string
          property_identifier?: string | null
          rooms?: number | null
          status: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          accepts_pets?: boolean | null
          area?: number | null
          bathrooms?: number | null
          complement?: string | null
          created_at?: string | null
          description?: string | null
          has_furniture?: boolean | null
          has_garage?: boolean | null
          id?: string
          image_count?: number
          images?: Json | null
          location_id?: string
          property_identifier?: string | null
          rooms?: number | null
          status?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
        ]
      }
      rental_terminations: {
        Row: {
          created_at: string | null
          final_balance: number | null
          id: string
          notes: string | null
          payment_breakdown: Json | null
          payment_id: string | null
          rental_id: string
          termination_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          final_balance?: number | null
          id?: string
          notes?: string | null
          payment_breakdown?: Json | null
          payment_id?: string | null
          rental_id: string
          termination_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          final_balance?: number | null
          id?: string
          notes?: string | null
          payment_breakdown?: Json | null
          payment_id?: string | null
          rental_id?: string
          termination_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_terminations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_terminations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_terminations_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          attachments: Json | null
          contract_attachments: Json | null
          created_at: string | null
          deposit_installments: number | null
          deposit_value: number | null
          end_date: string | null
          garage_value: number | null
          has_garage: boolean | null
          has_partner_broker: boolean | null
          id: string
          is_active: boolean | null
          partner_broker_value: number | null
          pix_code: string | null
          property_id: string
          rent_due_day: number | null
          rent_value: number | null
          returned_deposit_amount: number | null
          security_deposit: number | null
          start_date: string
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          contract_attachments?: Json | null
          created_at?: string | null
          deposit_installments?: number | null
          deposit_value?: number | null
          end_date?: string | null
          garage_value?: number | null
          has_garage?: boolean | null
          has_partner_broker?: boolean | null
          id?: string
          is_active?: boolean | null
          partner_broker_value?: number | null
          pix_code?: string | null
          property_id: string
          rent_due_day?: number | null
          rent_value?: number | null
          returned_deposit_amount?: number | null
          security_deposit?: number | null
          start_date: string
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          contract_attachments?: Json | null
          created_at?: string | null
          deposit_installments?: number | null
          deposit_value?: number | null
          end_date?: string | null
          garage_value?: number | null
          has_garage?: boolean | null
          has_partner_broker?: boolean | null
          id?: string
          is_active?: boolean | null
          partner_broker_value?: number | null
          pix_code?: string | null
          property_id?: string
          rent_due_day?: number | null
          rent_value?: number | null
          returned_deposit_amount?: number | null
          security_deposit?: number | null
          start_date?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_menu_permissions: {
        Row: {
          can_access: boolean | null
          created_at: string | null
          id: string
          menu_item: string
          role: string
          updated_at: string | null
        }
        Insert: {
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          menu_item: string
          role: string
          updated_at?: string | null
        }
        Update: {
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          menu_item?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_users: {
        Row: {
          active: boolean
          auth_user_id: string | null
          blocked_until: string | null
          cpf: string | null
          created_at: string | null
          email: string
          id: string
          login_attempts: number | null
          name: string
          password_hash: string | null
          phone: string | null
          photo: string | null
          requires_password_change: boolean | null
          rg: string | null
          role: string
          temporary_password: boolean | null
          theme: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          blocked_until?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          id?: string
          login_attempts?: number | null
          name: string
          password_hash?: string | null
          phone?: string | null
          photo?: string | null
          requires_password_change?: boolean | null
          rg?: string | null
          role?: string
          temporary_password?: boolean | null
          theme?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          blocked_until?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          id?: string
          login_attempts?: number | null
          name?: string
          password_hash?: string | null
          phone?: string | null
          photo?: string | null
          requires_password_change?: boolean | null
          rg?: string | null
          role?: string
          temporary_password?: boolean | null
          theme?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          city: string | null
          complement: string | null
          cpf: string | null
          created_at: string | null
          document: string | null
          document_type: string | null
          email: string | null
          id: string
          name: string
          neighborhood: string | null
          number: string | null
          phone: string | null
          rg: string | null
          state: string | null
          status: string
          street: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          rg?: string | null
          state?: string | null
          status: string
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          city?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string | null
          document?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          number?: string | null
          phone?: string | null
          rg?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      user_fee_exemptions: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fee_exemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_fee_exemptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "user_fee_exemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_location_permissions: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          location_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          location_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          location_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_permissions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "user_location_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_metrics: {
        Row: {
          active_rentals: number | null
          active_tenants: number | null
          available_properties: number | null
          occupied_properties: number | null
          total_properties: number | null
          total_tenants: number | null
          unavailable_properties: number | null
        }
        Relationships: []
      }
      mv_dashboard_stats: {
        Row: {
          active_contracts: number | null
          available_properties: number | null
          expiring_contracts: number | null
          last_updated: string | null
          occupied_properties: number | null
          total_properties: number | null
          total_tenants: number | null
          unavailable_properties: number | null
        }
        Relationships: []
      }
      mv_monthly_expenses: {
        Row: {
          id: string | null
          location_id: string | null
          reference_month: number | null
          reference_year: number | null
          total_expenses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "location_expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
        ]
      }
      mv_monthly_payments: {
        Row: {
          due_date: string | null
          expected_amount: number | null
          id: string | null
          location_id: string | null
          paid_amount: number | null
          payment_date: string | null
          property_id: string | null
          reference_month: string | null
          reference_year: string | null
          rental_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "mv_monthly_revenue"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "rentals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_monthly_revenue: {
        Row: {
          expected_amount: number | null
          last_updated: string | null
          location_id: string | null
          location_name: string | null
          month: number | null
          month_date: string | null
          paid_amount: number | null
          payment_count: number | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      authenticate_user_secure: {
        Args: { p_login: string; p_password: string }
        Returns: {
          auth_id: string
          user_active: boolean
          user_cpf: string
          user_created_at: string
          user_email: string
          user_id: string
          user_name: string
          user_phone: string
          user_photo: string
          user_rg: string
          user_role: string
          user_username: string
        }[]
      }
      authenticate_user_simple: {
        Args: { p_password: string; p_username_or_email: string }
        Returns: {
          auth_id: string
          user_active: boolean
          user_cpf: string
          user_email: string
          user_id: string
          user_name: string
          user_phone: string
          user_photo: string
          user_rg: string
          user_role: string
          user_username: string
          user_usuario: string
        }[]
      }
      calculate_correct_payment_status: {
        Args: {
          p_discount: number
          p_expected_amount: number
          p_interest: number
          p_late_fee: number
          p_paid_amount: number
          p_payment_date: string
        }
        Returns: string
      }
      create_auth_mapping_for_migration: {
        Args: { p_auth_user_id: string; p_system_user_id: string }
        Returns: undefined
      }
      days_between: { Args: { date1: string; date2: string }; Returns: number }
      delete_location_permanently: {
        Args: { location_id: string }
        Returns: boolean
      }
      get_available_properties: {
        Args: never
        Returns: {
          accepts_pets: boolean
          area: number
          bathrooms: number
          complement: string
          created_at: string
          description: string
          garage_value: number
          has_furniture: boolean
          has_garage: boolean
          id: string
          images: Json
          location_city: string
          location_id: string
          location_name: string
          location_neighborhood: string
          location_state: string
          property_identifier: string
          rooms: number
          status: string
          value: number
        }[]
      }
      get_correct_due_date: {
        Args: { p_month: number; p_preferred_day: number; p_year: number }
        Returns: string
      }
      get_expected_revenue: {
        Args: { p_month?: number; p_user_id?: string; p_year?: number }
        Returns: number
      }
      get_overdue_payments_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_properties_with_locations: {
        Args: never
        Returns: {
          accepts_pets: boolean
          area: number
          bathrooms: number
          complement: string
          created_at: string
          description: string
          garage_value: number
          has_furniture: boolean
          has_garage: boolean
          id: string
          images: Json
          location_city: string
          location_complement: string
          location_id: string
          location_is_active: boolean
          location_name: string
          location_neighborhood: string
          location_number: string
          location_state: string
          location_street: string
          location_zip_code: string
          property_identifier: string
          rooms: number
          status: string
          updated_at: string
          value: number
        }[]
      }
      get_system_user_id: { Args: never; Returns: string }
      get_valid_due_date: {
        Args: { p_month: number; p_rent_due_day: number; p_year: number }
        Returns: string
      }
      hash_password: { Args: { plain_password: string }; Returns: string }
      is_valid_uuid: { Args: { uuid_text: string }; Returns: boolean }
      migrate_system_user_to_auth: {
        Args: { p_email: string; p_password: string; p_system_user_id: string }
        Returns: string
      }
      migrate_user_to_auth: {
        Args: { p_email: string; p_password: string; p_user_id?: string }
        Returns: string
      }
      refresh_dashboard_views: { Args: never; Returns: undefined }
      sync_user_to_auth: {
        Args: {
          p_email: string
          p_full_name: string
          p_password_hash: string
          p_system_user_id: string
        }
        Returns: string
      }
      test_properties_only: {
        Args: never
        Returns: {
          created_at: string
          id: string
          status: string
          value: number
        }[]
      }
      user_has_location_access: {
        Args: { p_location_id: string; p_user_id: string }
        Returns: boolean
      }
      verify_password: {
        Args: { password_hash: string; plain_password: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
