-- Payment evidence is stored in a private bucket. The Edge Function issues
-- short-lived signed upload/read URLs; no public bucket access is granted.
alter table public.tiktok_orders
  add column if not exists payment_evidence_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tiktok-order-images', 'tiktok-order-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
