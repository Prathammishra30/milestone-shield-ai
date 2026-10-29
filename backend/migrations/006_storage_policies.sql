-- ==============================================================================
-- Migration: 006_storage_policies.sql
-- Description: Private Supabase Storage bucket for milestone deliverables
--              with strict Row-Level Security, size restrictions, and MIME allowlists.
-- ==============================================================================

-- 1. Create private 'deliverables' bucket if storage schema exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'deliverables',
      'deliverables',
      FALSE, -- strictly private; requires signed URLs or authenticated RLS
      26214400, -- 25 MB max file size limit
      ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'application/zip',
        'text/plain',
        'application/json'
      ]
    )
    ON CONFLICT (id) DO UPDATE
    SET
      public = FALSE,
      file_size_limit = 26214400,
      allowed_mime_types = ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'application/zip',
        'text/plain',
        'application/json'
      ];
  END IF;
END $$;

-- 2. Storage RLS Policies
-- Objects in 'deliverables' are organized by contract path: "deliverables/{contract_id}/{milestone_id}/{filename}"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN

    -- Enable RLS on storage.objects
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    -- Policy A: Contract members can download/view milestone deliverables
    DROP POLICY IF EXISTS "deliverables_select_contract_member" ON storage.objects;
    CREATE POLICY "deliverables_select_contract_member"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'deliverables' AND
        EXISTS (
          SELECT 1 FROM public.contract_memberships
          WHERE contract_memberships.contract_id::text = (storage.foldername(name))[1]
            AND contract_memberships.user_id = auth.uid()
        )
      );

    -- Policy B: Only assigned freelancers of the contract can upload deliverables
    DROP POLICY IF EXISTS "deliverables_insert_freelancer" ON storage.objects;
    CREATE POLICY "deliverables_insert_freelancer"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'deliverables' AND
        EXISTS (
          SELECT 1 FROM public.contract_memberships
          WHERE contract_memberships.contract_id::text = (storage.foldername(name))[1]
            AND contract_memberships.user_id = auth.uid()
            AND contract_memberships.role = 'freelancer'
        )
      );

    -- Policy C: Tamper-resistance — deliverable artifacts are immutable once submitted
    DROP POLICY IF EXISTS "deliverables_prevent_update" ON storage.objects;
    CREATE POLICY "deliverables_prevent_update"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (FALSE);

    DROP POLICY IF EXISTS "deliverables_prevent_delete" ON storage.objects;
    CREATE POLICY "deliverables_prevent_delete"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (FALSE);

  END IF;
END $$;
