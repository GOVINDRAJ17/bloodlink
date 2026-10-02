-- Migration 005: Features Expansion (Screening, Chronic Care, Broadcasts, Hospital Mgmt, In-Transit)

-- 1. Extend donor_profiles with medical screening & clinical eligibility
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS surgeries JSONB DEFAULT '[]';
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS genetic_diseases JSONB DEFAULT '[]';
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS chronic_conditions JSONB DEFAULT '[]';
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]';
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS is_eligible BOOLEAN DEFAULT TRUE;
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS ineligibility_reasons TEXT[] DEFAULT '{}';
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS screening_completed_at TIMESTAMPTZ;

-- 2. Extend blood_requests with in-transit tracking attributes
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS is_in_transit BOOLEAN DEFAULT FALSE;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS vehicle_id TEXT;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS transit_destination TEXT;
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS current_speed_kmh NUMERIC(5,2);

-- 3. Chronic Care Patients Table
CREATE TABLE IF NOT EXISTS chronic_care_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  condition_type TEXT NOT NULL CHECK (condition_type IN ('THALASSEMIA_MAJOR', 'LEUKEMIA', 'SICKLE_CELL', 'APLASTIC_ANEMIA', 'OTHER')),
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  required_component TEXT DEFAULT 'Packed Red Blood Cells',
  units_per_cycle INT DEFAULT 2 CHECK (units_per_cycle > 0),
  cycle_frequency_days INT DEFAULT 21 CHECK (cycle_frequency_days > 0),
  next_transfusion_date DATE NOT NULL,
  last_transfusion_date DATE,
  primary_hospital_id UUID REFERENCES hospital_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'DISCHARGED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Transfusion Schedules Table
CREATE TABLE IF NOT EXISTS transfusion_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES chronic_care_patients(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospital_profiles(id) ON DELETE SET NULL,
  scheduled_date TIMESTAMPTZ NOT NULL,
  units INT DEFAULT 2,
  blood_group TEXT NOT NULL,
  component TEXT DEFAULT 'Packed Red Blood Cells',
  status TEXT DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'MATCHED', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  reserved_donor_id UUID REFERENCES donor_profiles(id) ON DELETE SET NULL,
  reserved_inventory_id UUID REFERENCES blood_inventory(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Emergency Broadcasts Table (Natural Calamities & Mass Mobilization)
CREATE TABLE IF NOT EXISTS emergency_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('DISASTER_CALAMITY', 'CRITICAL_SHORTAGE', 'MASS_CASUALTY')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  epicenter_location GEOGRAPHY(POINT, 4326),
  epicenter_name TEXT,
  radius_km NUMERIC(5,2) DEFAULT 50.0,
  target_blood_groups TEXT[] DEFAULT '{}',
  recipient_count INT DEFAULT 0,
  status TEXT DEFAULT 'DISPATCHED' CHECK (status IN ('DRAFT', 'DISPATCHED', 'RESOLVED')),
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS emergency_broadcasts_location_idx ON emergency_broadcasts USING GIST(epicenter_location);

-- 6. Donation Camps Table
CREATE TABLE IF NOT EXISTS donation_camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospital_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location_name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_units INT DEFAULT 100,
  collected_units INT DEFAULT 0,
  registered_donors_count INT DEFAULT 0,
  status TEXT DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'CONCLUDED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS donation_camps_location_idx ON donation_camps USING GIST(location);

-- 7. Donor Appointments Table
CREATE TABLE IF NOT EXISTS donor_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES hospital_profiles(id) ON DELETE CASCADE,
  appointment_date TIMESTAMPTZ NOT NULL,
  time_slot TEXT NOT NULL,
  blood_group TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Donor Verifications Table
CREATE TABLE IF NOT EXISTS donor_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID REFERENCES donor_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('GOVT_ID', 'BLOOD_GROUP_CERT', 'MEDICAL_FITNESS', 'DONATION_RECORD')),
  document_url TEXT NOT NULL,
  document_number TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
