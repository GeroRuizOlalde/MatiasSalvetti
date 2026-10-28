-- =============================================================================
-- Storage: capturas de verificación (privado) y assets públicos.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('verifications', 'verifications', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('public-assets', 'public-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- verifications: cada viewer sube dentro de su carpeta <user_id>/...
create policy "verifications_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verifications'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verifications_owner_or_admin_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verifications'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "verifications_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'verifications' and public.is_admin());

-- public-assets: lectura pública (el bucket es público); escritura del panel.
create policy "public_assets_mod_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_mod());

create policy "public_assets_mod_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'public-assets' and public.is_mod())
  with check (bucket_id = 'public-assets' and public.is_mod());

create policy "public_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_admin());
