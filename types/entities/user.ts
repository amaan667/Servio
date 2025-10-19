/**
 * User Entity Types
 */

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  preferences?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserProfileRequest {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  preferences?: Record<string, unknown>;
}

