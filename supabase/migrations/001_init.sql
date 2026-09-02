-- Migration 001: Initial Core Schema Definitions

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT CHECK (role IN ('DONOR','HOSPITAL','BLOOD_BANK','ADMIN')),
  avatar_url TEXT,
  is_profile_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DONOR PROFILES TABLE
CREATE TABLE IF NOT EXISTS donor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blood_group TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  available BOOLEAN DEFAULT TRUE,
  last_donation_date DATE,
  total_donations INT DEFAULT 0,
  reliability_score NUMERIC(4,2) DEFAULT 100.0,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. HOSPITAL PROFILES TABLE
CREATE TABLE IF NOT EXISTS hospital_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  hospital_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BLOOD BANK PROFILES TABLE
CREATE TABLE IF NOT EXISTS blood_bank_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blood_bank_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BLOOD REQUESTS TABLE
CREATE TABLE IF NOT EXISTS blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospital_profiles(id),
  blood_group TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_required INT NOT NULL CHECK (units_required > 0),
  units_fulfilled INT DEFAULT 0,
  urgency TEXT CHECK (urgency IN ('NORMAL','URGENT','CRITICAL')),
  required_by TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING' CHECK (status IN (
    'PENDING','SEARCHING','NOTIFIED',
    'PARTIALLY_FULFILLED','FULFILLED',
    'CANCELLED','EXPIRED')),
  additional_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DONOR RESPONSES TABLE
CREATE TABLE IF NOT EXISTS donor_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES blood_requests(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE CASCADE,
  match_score NUMERIC(5,2),
  distance_km NUMERIC(6,2),
  status TEXT DEFAULT 'NOTIFIED' CHECK (status IN (
    'NOTIFIED','VIEWED','ACCEPTED','REJECTED',
    'EXPIRED','ASSIGNED','COMPLETED')),
  notified_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (request_id, donor_id)
);

-- 7. BLOOD INVENTORY TABLE
CREATE TABLE IF NOT EXISTS blood_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_bank_id UUID REFERENCES blood_bank_profiles(id) ON DELETE CASCADE,
  blood_group TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_available INT DEFAULT 0 CHECK (units_available >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blood_bank_id, blood_group)
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN (
    'EMERGENCY_REQUEST','DONOR_MATCH','DONOR_ACCEPTED',
    'REQUEST_FULFILLED','REQUEST_CANCELLED',
    'LOW_INVENTORY','SYSTEM')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DONATIONS TABLE
CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE CASCADE,
  request_id UUID REFERENCES blood_requests(id),
  donated_at TIMESTAMPTZ DEFAULT NOW(),
  units INT DEFAULT 1,
  notes TEXT
);

-- 10. PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blood_group TEXT,
  location_name TEXT,
  predicted_demand INT,
  available_units INT,
  shortage_risk TEXT CHECK (shortage_risk IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  prediction_date DATE,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
