UPDATE "users"
SET profile_completed_at = COALESCE(profile_updated_at, created_at)
WHERE profile_completed_at IS NULL
  AND full_name IS NOT NULL
  AND year IS NOT NULL
  AND major IS NOT NULL
  AND account_status = 'active';
