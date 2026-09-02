-- Migration 004: PostGIS Functions & Database Helpers

-- 1. PostGIS Nearby Compatible Donors Search Function
CREATE OR REPLACE FUNCTION find_nearby_donors(
  request_location GEOGRAPHY,
  blood_groups TEXT[],
  radius_meters FLOAT,
  limit_count INT DEFAULT 20
)
RETURNS TABLE (
  donor_id UUID,
  user_id UUID,
  blood_group TEXT,
  distance_meters FLOAT,
  available BOOLEAN,
  reliability_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dp.id AS donor_id,
    dp.user_id,
    dp.blood_group,
    ST_Distance(dp.location, request_location) AS distance_meters,
    dp.available,
    dp.reliability_score
  FROM donor_profiles dp
  WHERE
    dp.available = TRUE
    AND dp.blood_group = ANY(blood_groups)
    AND ST_DWithin(dp.location, request_location, radius_meters)
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Timestamp Trigger for Automatic updated_at Updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_modtime
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donor_profiles_modtime
BEFORE UPDATE ON donor_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blood_requests_modtime
BEFORE UPDATE ON blood_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
