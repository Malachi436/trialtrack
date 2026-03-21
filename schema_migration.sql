-- ============================================
-- TrialTrack Schema Migration
-- Adds support for Growth/Yield parameter grouping and Soil Analysis
-- Run this SQL in Supabase Dashboard > SQL Editor
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Add new columns to fields table
-- ============================================

-- Growth parameter configuration
ALTER TABLE fields ADD COLUMN IF NOT EXISTS growth_param_count INTEGER DEFAULT 3;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS growth_params JSONB DEFAULT '["Height", "Leaf Count", "Stem Diameter"]';

-- Yield parameter configuration
ALTER TABLE fields ADD COLUMN IF NOT EXISTS yield_param_count INTEGER DEFAULT 3;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS yield_params JSONB DEFAULT '["Fruit Weight", "Fruit Count", "Total Yield"]';

-- Soil analysis configuration
ALTER TABLE fields ADD COLUMN IF NOT EXISTS soil_analysis_fields JSONB DEFAULT '["pH", "Nitrogen (N)", "Phosphorus (P)", "Potassium (K)", "Organic Matter"]';
ALTER TABLE fields ADD COLUMN IF NOT EXISTS soil_before_status TEXT DEFAULT 'none';
ALTER TABLE fields ADD COLUMN IF NOT EXISTS soil_after_status TEXT DEFAULT 'none';

-- ============================================
-- Create soil_analysis table
-- ============================================

CREATE TABLE IF NOT EXISTS soil_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('before', 'after')),
  submitted_by UUID REFERENCES users(id),
  submitted_by_name TEXT,
  recorded_date DATE NOT NULL,
  values JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_id, analysis_type)
);

-- Enable Row Level Security for soil_analysis
ALTER TABLE soil_analysis ENABLE ROW LEVEL SECURITY;

-- Create policy for soil_analysis (allow all operations for authenticated users)
DROP POLICY IF EXISTS "Allow all for soil_analysis" ON soil_analysis;
CREATE POLICY "Allow all for soil_analysis" ON soil_analysis
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Update entries table to support up to 20 parameters
-- ============================================

-- Add additional parameter columns
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param7 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param8 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param9 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param10 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param11 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param12 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param13 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param14 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param15 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param16 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param17 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param18 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param19 NUMERIC;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS param20 NUMERIC;

-- ============================================
-- Verify the changes
-- ============================================

-- Check fields table structure
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fields' AND column_name LIKE '%param%';

-- Check soil_analysis table exists
-- SELECT * FROM soil_analysis LIMIT 1;
