// types/access.ts
// Visibility, sharing, organisations, licences — backend app/services/access_service.py, endpoints access.py / orgs.py.

export type Visibility = 'public' | 'private'
export type Pipeline = 'batch' | 'stream'
export type PostType = 'standard' | 'live'

export interface Party { handle: string | null; label: string; account_type?: string; domain?: string }

export interface ShareRow {
  share_id: string
  grantee_type: 'user' | 'org'
  grantee_id: string
  grantee: Party
  permission: string
  granted_by: Party | null
  granted_at: string | null
  revoked_at: string | null
  revoked_by: Party | null
  active: boolean
}

export interface AccessDetails {
  kind: 'post' | 'dataset'
  id: string
  visibility: Visibility
  grants: ShareRow[]
  history: ShareRow[]
  dataset_visibility?: Visibility | null     // posts: the dataset behind it
  can_be_public?: boolean                    // posts: false when the dataset is private and only shared with the publisher
}

export interface SharedBy { label: string | null; handle: string | null; at: string | null; via: string }

export interface SharedWithMe {
  posts: any[]                                // PostResponse + shared_by
  datasets: (Record<string, any> & { shared_by: SharedBy })[]
}

export interface OrgCard {
  org_id: string
  name: string
  email_domain: string
  status: 'pending' | 'verified' | 'rejected'
  handle: string | null
  member_count: number
  created_at?: string | null
  reviewed_at?: string | null
  account_email?: string | null
  role?: string
}

export interface MyOrgs {
  account_type: 'individual' | 'organization'
  organization: OrgCard | null
  memberships: OrgCard[]
  email_domain: string
}

export interface Licence {
  code: string
  name: string
  group: 'open' | 'restricted' | 'closed'
  url: string | null
  attribution: boolean
  rows_public: boolean
  commercial: boolean
  share_alike: boolean
  public_ok: boolean
}

export interface LicenceSummary {
  code: string; name: string; url: string | null; attribution: boolean; commercial: boolean
  share_alike: boolean; rows_public: boolean; group: string
}