-- ═══════════════════════════════════════════════════════════════════════════
-- Farmerrr — armazenamento das miniaturas
--
-- O `cover_image_url` do TikTok é um link de CDN com validade de ~6 horas.
-- Guardá-lo em bruto dá leaderboards com imagens partidas ao fim de meio dia,
-- por isso a imagem é copiada para aqui no primeiro sync.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('thumbs', 'thumbs', true)
on conflict (id) do nothing;

-- Leitura pública (as miniaturas aparecem em páginas públicas).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'thumbs: leitura pública'
  ) then
    create policy "thumbs: leitura pública"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'thumbs');
  end if;
end
$$;

-- A escrita fica reservada ao service_role, que ignora RLS.
