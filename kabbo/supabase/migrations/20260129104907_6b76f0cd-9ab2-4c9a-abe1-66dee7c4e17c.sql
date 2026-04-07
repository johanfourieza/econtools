-- Update handle_new_user function to add input validation for display_name
-- This sanitizes the display_name extracted from raw_user_meta_data

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_display_name text;
  sanitized_display_name text;
BEGIN
  -- Extract raw display_name from user metadata
  raw_display_name := new.raw_user_meta_data ->> 'display_name';
  
  -- Sanitize the display_name:
  -- 1. Trim whitespace
  -- 2. Limit to 100 characters max
  -- 3. Remove any control characters (ASCII 0-31 except tab/newline)
  -- 4. Fall back to email username if empty/null
  IF raw_display_name IS NOT NULL AND length(trim(raw_display_name)) > 0 THEN
    -- Trim and limit length
    sanitized_display_name := left(trim(raw_display_name), 100);
    -- Remove control characters (keep printable ASCII and unicode)
    sanitized_display_name := regexp_replace(sanitized_display_name, '[\x00-\x08\x0B\x0C\x0E-\x1F]', '', 'g');
    -- If after sanitization it's empty, use email fallback
    IF length(trim(sanitized_display_name)) = 0 THEN
      sanitized_display_name := split_part(new.email, '@', 1);
    END IF;
  ELSE
    -- Use email username as fallback
    sanitized_display_name := split_part(new.email, '@', 1);
  END IF;
  
  -- Ensure fallback is also limited in length
  sanitized_display_name := left(sanitized_display_name, 100);
  
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, sanitized_display_name);
  
  RETURN new;
END;
$$;