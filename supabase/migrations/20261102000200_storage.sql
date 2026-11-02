-- =============================================================================
-- AgencyOS AI — Supabase Storage bucket for organization assets (logos).
-- The bucket is private. Uploads and reads happen server-side only, after the
-- server has validated organization membership, role, file type (magic bytes)
-- and size. Skipped automatically when the storage schema is absent (plain
-- Postgres used for local tests).
-- =============================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('org-assets', 'org-assets', false, 2097152, array['image/png', 'image/jpeg'])
    on conflict (id) do update
      set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  end if;
end
$$;
