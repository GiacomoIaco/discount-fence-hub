-- Discount Fence USA Operations Hub - Database Schema
-- Created: 2025-10-02

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sales Reps Table
CREATE TABLE public.sales_reps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Request Types Enum
CREATE TYPE request_type AS ENUM (
    'custom_pricing',
    'builder_community',
    'installation_issue',
    'material_request',
    'customer_escalation'
);

-- Request Status Enum
CREATE TYPE request_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
);

-- Requests Table
CREATE TABLE public.requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID NOT NULL REFERENCES public.sales_reps(id) ON DELETE CASCADE,
    request_type request_type NOT NULL,
    status request_status DEFAULT 'pending',

    -- Customer Information
    customer_name TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,

    -- Request Details
    fence_type TEXT,
    linear_feet INTEGER,
    special_requirements TEXT,
    deadline DATE,
    urgency TEXT,
    description TEXT,

    -- Voice Recording
    voice_recording_url TEXT,
    voice_recording_duration INTEGER, -- in seconds
    transcript TEXT,

    -- AI Parsing Confidence
    confidence_scores JSONB,

    -- Photos
    photo_urls TEXT[],

    -- Response
    response_notes TEXT,
    pricing_quote DECIMAL(10, 2),
    responded_at TIMESTAMP WITH TIME ZONE,
    responded_by UUID REFERENCES public.sales_reps(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Client Presentations Table
CREATE TABLE public.presentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_urls TEXT[] NOT NULL,
    shared_link TEXT UNIQUE,
    created_by UUID REFERENCES public.sales_reps(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROI Calculations Table (for tracking Pre-Stain calculator usage)
CREATE TABLE public.roi_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rep_id UUID REFERENCES public.sales_reps(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,

    -- Input Values
    fence_length INTEGER NOT NULL,
    fence_height INTEGER NOT NULL,
    price_per_gallon DECIMAL(10, 2),
    coverage_per_gallon DECIMAL(10, 2),
    waste_percentage DECIMAL(5, 2),
    labor_rate DECIMAL(10, 2),

    -- Calculated Results
    total_sqft INTEGER,
    gallons_needed DECIMAL(10, 2),
    stain_cost DECIMAL(10, 2),
    additional_material_cost DECIMAL(10, 2),
    total_material_cost DECIMAL(10, 2),
    labor_hours DECIMAL(10, 2),
    labor_cost DECIMAL(10, 2),
    total_diy_cost DECIMAL(10, 2),
    cost_per_linear_foot DECIMAL(10, 2),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Photos Table (for photo gallery)
CREATE TABLE public.photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.sales_reps(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT false,
    likes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'archived')),

    -- AI metadata
    suggested_tags TEXT[],
    quality_score INTEGER CHECK (quality_score BETWEEN 1 AND 10),

    -- Admin review
    reviewed_by UUID REFERENCES public.sales_reps(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Client presentation
    client_selections JSONB DEFAULT '[]'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Activity Log Table (for audit trail)
CREATE TABLE public.activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.sales_reps(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for better query performance
CREATE INDEX idx_requests_rep_id ON public.requests(rep_id);
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX idx_roi_calculations_rep_id ON public.roi_calculations(rep_id);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX idx_photos_status ON public.photos(status);
CREATE INDEX idx_photos_uploaded_by ON public.photos(uploaded_by);
CREATE INDEX idx_photos_tags ON public.photos USING GIN(tags);

-- Row Level Security (RLS) Policies
ALTER TABLE public.sales_reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roi_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Policies for sales_reps
CREATE POLICY "Users can view their own profile"
    ON public.sales_reps FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.sales_reps FOR UPDATE
    USING (auth.uid() = id);

-- Policies for requests
CREATE POLICY "Sales reps can view their own requests"
    ON public.requests FOR SELECT
    USING (auth.uid() = rep_id);

CREATE POLICY "Sales reps can insert their own requests"
    ON public.requests FOR INSERT
    WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Sales reps can update their own requests"
    ON public.requests FOR UPDATE
    USING (auth.uid() = rep_id);

-- Policies for ROI calculations
CREATE POLICY "Sales reps can view their own calculations"
    ON public.roi_calculations FOR SELECT
    USING (auth.uid() = rep_id);

CREATE POLICY "Sales reps can insert their own calculations"
    ON public.roi_calculations FOR INSERT
    WITH CHECK (auth.uid() = rep_id);

-- Policies for presentations
CREATE POLICY "Users can view all presentations"
    ON public.presentations FOR SELECT
    USING (true);

CREATE POLICY "Users can insert presentations"
    ON public.presentations FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Policies for activity log
CREATE POLICY "Users can view their own activity"
    ON public.activity_log FOR SELECT
    USING (auth.uid() = user_id);

-- Policies for photos
-- Sales users can upload photos
CREATE POLICY "Users can insert photos"
    ON public.photos FOR INSERT
    WITH CHECK (auth.uid() = uploaded_by);

-- Sales users can view published photos only
CREATE POLICY "Sales users can view published photos"
    ON public.photos FOR SELECT
    USING (
        status = 'published'
        OR auth.uid() = uploaded_by
        OR EXISTS (
            SELECT 1 FROM public.sales_reps
            WHERE id = auth.uid()
            AND email IN (
                SELECT email FROM public.sales_reps sr
                WHERE sr.id = auth.uid()
                AND (
                    email LIKE '%@manager%'
                    OR email LIKE '%@admin%'
                )
            )
        )
    );

-- Users can update their own photos (favorites, likes)
CREATE POLICY "Users can update their own photos"
    ON public.photos FOR UPDATE
    USING (auth.uid() = uploaded_by);

-- Managers can update any pending/published photo for review
CREATE POLICY "Managers can review photos"
    ON public.photos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.sales_reps
            WHERE id = auth.uid()
            AND (
                email LIKE '%@manager%'
                OR email LIKE '%@admin%'
            )
        )
    );

-- Users can delete photos they uploaded
CREATE POLICY "Users can delete their own photos"
    ON public.photos FOR DELETE
    USING (auth.uid() = uploaded_by);

-- Admins can delete any photo
CREATE POLICY "Admins can delete any photo"
    ON public.photos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.sales_reps
            WHERE id = auth.uid()
            AND email LIKE '%@admin%'
        )
    );

-- Functions for updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.sales_reps
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.presentations
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.photos
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Storage Buckets (already created in Supabase Dashboard)
-- 1. 'voice-recordings' - for audio files from voice requests ✅
-- 2. 'photos' - for photo gallery images (full size and thumbnails) ✅
-- 3. 'presentations' - for client presentation files (PDFs, PPTs) ✅

-- Storage Policies (apply in Supabase Dashboard):
-- voice-recordings bucket:
--   - INSERT: authenticated users can upload
--   - SELECT: users can only access their own files
--   - DELETE: users can only delete their own files

-- photos bucket (PRIVATE):
--   Folder structure: {userId}/full/{photoId}.jpg and {userId}/thumb/{photoId}.jpg
--   - INSERT: authenticated users can upload
--   - SELECT:
--       * Sales users: can view published photos only (via database query)
--       * Managers/Admins: can view all photos
--   - DELETE:
--       * Users: can delete their own photos
--       * Admins: can delete any photo

-- presentations bucket:
--   - INSERT: authenticated users can upload
--   - SELECT: all authenticated users can view
--   - UPDATE: creator can update
--   - DELETE: creator can delete
