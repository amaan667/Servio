/**
 * Staff Entity Types
 */

export type StaffRole = 
  | 'owner'
  | 'manager'
  | 'staff'
  | 'kitchen'
  | 'waiter';

export interface StaffMember {
  id: string;
  venue_id: string;
  user_id: string;
  role: StaffRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface CreateStaffRequest {
  venueId: string;
  email: string;
  role: StaffRole;
}

export interface UpdateStaffRequest {
  staffId: string;
  venueId: string;
  updates: {
    role?: StaffRole;
    is_active?: boolean;
  };
}

export interface StaffInvitation {
  id: string;
  venue_id: string;
  email: string;
  role: StaffRole;
  invited_by: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  expires_at: string;
  created_at: string;
  accepted_at?: string;
}

