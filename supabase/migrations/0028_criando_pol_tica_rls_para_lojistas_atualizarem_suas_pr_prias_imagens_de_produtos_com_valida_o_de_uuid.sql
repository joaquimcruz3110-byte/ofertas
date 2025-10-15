CREATE POLICY "Shopkeepers can update their own product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product_images' AND
  auth.uid() = (
    CASE
      WHEN owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN owner_id::uuid
      ELSE NULL
    END
  ) AND
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = (
      CASE
        WHEN split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(name, '/', 2)::uuid
        ELSE NULL
      END
    )
    AND p.shopkeeper_id = (
      CASE
        WHEN owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN owner_id::uuid
        ELSE NULL
      END
    )
  )
)
WITH CHECK (
  bucket_id = 'product_images' AND
  auth.uid() = (
    CASE
      WHEN owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN owner_id::uuid
      ELSE NULL
    END
  ) AND
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = (
      CASE
        WHEN split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN split_part(name, '/', 2)::uuid
        ELSE NULL
      END
    )
    AND p.shopkeeper_id = (
      CASE
        WHEN owner_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN owner_id::uuid
        ELSE NULL
      END
    )
  )
);