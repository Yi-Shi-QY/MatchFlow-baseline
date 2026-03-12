ALTER TABLE matches
ADD COLUMN IF NOT EXISTS source_context JSONB DEFAULT '{}'::jsonb;

UPDATE matches
SET source_context = jsonb_set(
  COALESCE(source_context, '{}'::jsonb),
  '{domainId}',
  '"football"'::jsonb,
  true
)
WHERE COALESCE(source_context->>'domainId', '') = '';
