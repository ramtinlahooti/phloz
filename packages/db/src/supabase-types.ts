/**
 * Auto-generated Supabase TypeScript types. DO NOT EDIT MANUALLY.
 * Regenerate via: Supabase MCP `generate_typescript_types` tool,
 * or (when CLI is set up): `supabase gen types typescript`.
 *
 * Consumers typically prefer the Drizzle-derived types (see schema/*.ts).
 * These types are useful for the Supabase JS client (@supabase/supabase-js)
 * which is strongly typed against `Database`.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_campaigns: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creatives: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_groups: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_groups_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_keywords: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_keywords_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_platform_accounts: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          platform: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          platform: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          platform?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_platform_accounts_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_rules: {
        Row: {
          created_at: string
          definition: Json
          enabled: boolean
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          definition?: Json
          enabled?: boolean
          id?: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          definition?: Json
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_rules_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          id: string
          payload: Json
          processed_at: string | null
          stripe_event_id: string
          type: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          processed_at?: string | null
          stripe_event_id: string
          type: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          stripe_event_id?: string
          type?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_workspace_id_workspaces_id_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assets: {
        Row: {
          asset_type: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          url: string
          workspace_id: string
        }
        Insert: {
          asset_type?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          url: string
          workspace_id: string
        }
        Update: {
          asset_type?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          url?: string
          workspace_id?: string
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          portal_access: boolean
          role: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          portal_access?: boolean
          role?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          portal_access?: boolean
          role?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          archived_at: string | null
          archived_reason: string | null
          business_address: Json | null
          business_email: string | null
          business_name: string | null
          business_phone: string | null
          company_budget: number | null
          company_size: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          geo_targeting: Json | null
          id: string
          industry: string | null
          name: string
          notes: string | null
          target_cpa: number | null
          updated_at: string
          website_url: string | null
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_reason?: string | null
          business_address?: Json | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          company_budget?: number | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          geo_targeting?: Json | null
          id?: string
          industry?: string | null
          name: string
          notes?: string | null
          target_cpa?: number | null
          updated_at?: string
          website_url?: string | null
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          archived_reason?: string | null
          business_address?: Json | null
          business_email?: string | null
          business_name?: string | null
          business_phone?: string | null
          company_budget?: number | null
          company_size?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          geo_targeting?: Json | null
          id?: string
          industry?: string | null
          name?: string
          notes?: string | null
          target_cpa?: number | null
          updated_at?: string
          website_url?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string
          author_type: string
          body: string
          created_at: string
          id: string
          mentions: string[]
          parent_id: string
          parent_type: string
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          author_id: string
          author_type: string
          body: string
          created_at?: string
          id?: string
          mentions?: string[]
          parent_id: string
          parent_type: string
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          author_id?: string
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          mentions?: string[]
          parent_id?: string
          parent_type?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: []
      }
      inbound_email_addresses: {
        Row: {
          active: boolean
          address: string
          client_id: string
          created_at: string
          id: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          address: string
          client_id: string
          created_at?: string
          id?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          address?: string
          client_id?: string
          created_at?: string
          id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role: string
          token: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
          workspace_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          channel: string
          client_id: string
          created_at: string
          direction: string
          from_id: string | null
          from_type: string
          id: string
          raw_email: Json | null
          subject: string | null
          thread_id: string
          workspace_id: string
        }
        Insert: {
          body: string
          channel: string
          client_id: string
          created_at?: string
          direction: string
          from_id?: string | null
          from_type: string
          id?: string
          raw_email?: Json | null
          subject?: string | null
          thread_id: string
          workspace_id: string
        }
        Update: {
          body?: string
          channel?: string
          client_id?: string
          created_at?: string
          direction?: string
          from_id?: string | null
          from_type?: string
          id?: string
          raw_email?: Json | null
          subject?: string | null
          thread_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      portal_magic_links: {
        Row: {
          client_contact_id: string
          client_id: string
          created_at: string
          expires_at: string
          last_used_at: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          client_contact_id: string
          client_id: string
          created_at?: string
          expires_at: string
          last_used_at?: string | null
          token: string
          workspace_id: string
        }
        Update: {
          client_contact_id?: string
          client_id?: string
          created_at?: string
          expires_at?: string
          last_used_at?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: []
      }
      task_watchers: {
        Row: {
          created_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          department: string
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          priority: string
          related_message_id: string | null
          related_node_id: string | null
          status: string
          title: string
          updated_at: string
          visibility: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          related_message_id?: string | null
          related_node_id?: string | null
          status?: string
          title: string
          updated_at?: string
          visibility?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          related_message_id?: string | null
          related_node_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
          workspace_id?: string
        }
        Relationships: []
      }
      tracking_edges: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          edge_type: string
          id: string
          label: string | null
          metadata: Json
          source_node_id: string
          target_node_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          edge_type: string
          id?: string
          label?: string | null
          metadata?: Json
          source_node_id: string
          target_node_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          edge_type?: string
          id?: string
          label?: string | null
          metadata?: Json
          source_node_id?: string
          target_node_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      tracking_node_versions: {
        Row: {
          created_at: string
          id: string
          node_id: string
          snapshot: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_id: string
          snapshot: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          node_id?: string
          snapshot?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      tracking_nodes: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          health_status: string
          id: string
          label: string
          last_verified_at: string | null
          metadata: Json
          node_type: string
          position: Json | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          health_status?: string
          id?: string
          label: string
          last_verified_at?: string | null
          metadata?: Json
          node_type: string
          position?: Json | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          health_status?: string
          id?: string
          label?: string
          last_verified_at?: string | null
          metadata?: Json
          node_type?: string
          position?: Json | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      tracking_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          spec: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          spec?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          spec?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_member_client_access: {
        Row: {
          client_id: string
          created_at: string
          id: string
          workspace_member_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          workspace_member_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          workspace_member_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          settings: Json
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          settings?: Json
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          settings?: Json
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      phloz_custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      phloz_has_role_in: { Args: { allowed_roles: string[]; ws_id: string }; Returns: boolean }
      phloz_is_assigned_to: { Args: { c_id: string }; Returns: boolean }
      phloz_is_member_of: { Args: { ws_id: string }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
