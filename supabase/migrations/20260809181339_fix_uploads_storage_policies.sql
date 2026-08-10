-- O bucket "uploads" existe no PROD, mas ficou sem nenhuma política de
-- acesso (igual aconteceu com payment_methods) — por isso qualquer upload
-- de anexo (comprovante de pagamento, etc.) dava "new row violates row-level
-- security policy". Recria aqui exatamente as mesmas 5 políticas que já
-- existem no bucket "uploads" do DEV.

CREATE POLICY "Public can view uploaded files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

CREATE POLICY "Public can upload files"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'uploads');

CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');
