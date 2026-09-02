-- Migration 003: Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_bank_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES POLICIES
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. DONOR PROFILES POLICIES
CREATE POLICY "Donors can view own profile" ON donor_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Donors can update own profile" ON donor_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Donors can insert own profile" ON donor_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. HOSPITAL PROFILES POLICIES
CREATE POLICY "Hospitals can view own profile" ON hospital_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Hospitals can update own profile" ON hospital_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Hospitals can insert own profile" ON hospital_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. BLOOD BANK PROFILES POLICIES
CREATE POLICY "Blood Banks can view own profile" ON blood_bank_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Blood Banks can update own profile" ON blood_bank_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Blood Banks can insert own profile" ON blood_bank_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. BLOOD REQUESTS POLICIES
CREATE POLICY "Public authenticated can view requests" ON blood_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Hospitals can create requests" ON blood_requests
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM hospital_profiles hp
      WHERE hp.id = hospital_id AND hp.user_id = auth.uid()
    )
  );

CREATE POLICY "Hospitals can update own requests" ON blood_requests
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM hospital_profiles hp
      WHERE hp.id = hospital_id AND hp.user_id = auth.uid()
    )
  );

-- 6. DONOR RESPONSES POLICIES
CREATE POLICY "Donors view own responses" ON donor_responses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM donor_profiles dp
      WHERE dp.id = donor_id AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Donors update own responses" ON donor_responses
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM donor_profiles dp
      WHERE dp.id = donor_id AND dp.user_id = auth.uid()
    )
  );

-- 7. BLOOD INVENTORY POLICIES
CREATE POLICY "Authenticated users view inventory" ON blood_inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Blood Banks update own inventory" ON blood_inventory
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM blood_bank_profiles bbp
      WHERE bbp.id = blood_bank_id AND bbp.user_id = auth.uid()
    )
  );

-- 8. NOTIFICATIONS POLICIES
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
