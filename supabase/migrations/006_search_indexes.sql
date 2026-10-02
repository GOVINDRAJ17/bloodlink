-- Migration 006: Trigram / Text Search Indexes for Live Hospital Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast substring indexing on hospital_profiles for ILIKE %query%
CREATE INDEX IF NOT EXISTS idx_hospital_name_trgm ON hospital_profiles USING gin (hospital_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_hospital_address_trgm ON hospital_profiles USING gin (address gin_trgm_ops);

-- Fast substring indexing on blood_bank_profiles
CREATE INDEX IF NOT EXISTS idx_blood_bank_name_trgm ON blood_bank_profiles USING gin (blood_bank_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_blood_bank_address_trgm ON blood_bank_profiles USING gin (address gin_trgm_ops);
