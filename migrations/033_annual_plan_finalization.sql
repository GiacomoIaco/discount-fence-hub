-- Migration: Annual Plan Finalization and Approval Workflow
-- This migration adds support for finalizing annual plans and requiring super-admin approval

-- Create table to track annual plan status
CREATE TABLE IF NOT EXISTS public.annual_plan_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES public.project_functions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,

  -- Finalization tracking
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  finalized_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,

  -- Approval tracking
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,

  -- Rejection/reopening tracking
  is_rejected BOOLEAN NOT NULL DEFAULT FALSE,
  rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one status record per function/year combination
  UNIQUE(function_id, year)
);

-- Add comment to table
COMMENT ON TABLE public.annual_plan_status IS 'Tracks finalization and approval status of annual plans';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_annual_plan_status_function_year
  ON public.annual_plan_status(function_id, year);

CREATE INDEX IF NOT EXISTS idx_annual_plan_status_pending_approval
  ON public.annual_plan_status(is_finalized, is_approved)
  WHERE is_finalized = TRUE AND is_approved = FALSE AND is_rejected = FALSE;

-- Enable RLS
ALTER TABLE public.annual_plan_status ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read plan status
CREATE POLICY "Allow all authenticated users to view plan status"
  ON public.annual_plan_status
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can finalize their function's plan
CREATE POLICY "Allow authenticated users to finalize plans"
  ON public.annual_plan_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales_manager')
    )
  );

-- Policy: Only authenticated users can update plan status
CREATE POLICY "Allow authenticated users to update plan status"
  ON public.annual_plan_status
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'sales_manager')
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_annual_plan_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_annual_plan_status_updated_at
  BEFORE UPDATE ON public.annual_plan_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_annual_plan_status_updated_at();

-- Create function to check if a plan is locked (finalized and approved)
CREATE OR REPLACE FUNCTION public.is_annual_plan_locked(p_function_id UUID, p_year INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_locked BOOLEAN;
BEGIN
  SELECT COALESCE(is_finalized AND is_approved AND NOT is_rejected, FALSE)
  INTO v_is_locked
  FROM public.annual_plan_status
  WHERE function_id = p_function_id AND year = p_year;

  RETURN COALESCE(v_is_locked, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND email IN ('giacomo@discountfenceusa.com', 'giacomoiacoangeli@gmail.com')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.annual_plan_status TO authenticated;
GRANT USAGE ON SEQUENCE annual_plan_status_id_seq TO authenticated;
