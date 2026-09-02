-- Migration 002: PostGIS Extension & Spatial Indexes

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add Geography Point Columns (SRID 4326)
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
ALTER TABLE hospital_profiles ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
ALTER TABLE blood_bank_profiles ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- 3. Create Spatial GIST Indexes for Fast Expanding-Radius Search
CREATE INDEX IF NOT EXISTS donor_profiles_location_idx ON donor_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS hospital_profiles_location_idx ON hospital_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS blood_bank_profiles_location_idx ON blood_bank_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS blood_requests_location_idx ON blood_requests USING GIST(location);
