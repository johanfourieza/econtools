-- Create a secure RPC function to fetch team dashboard data
-- This ensures authorization is checked server-side before returning any data

CREATE OR REPLACE FUNCTION public.get_team_dashboard_data(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  has_access boolean;
BEGIN
  -- First, verify the user has dashboard access (server-side authorization)
  has_access := public.has_dashboard_access(_team_id);
  
  IF NOT has_access THEN
    -- Return null if user doesn't have access - no data leakage
    RETURN NULL;
  END IF;
  
  -- Fetch and aggregate all dashboard data server-side
  WITH member_data AS (
    SELECT 
      tm.id,
      tm.user_id,
      tm.role,
      p.display_name,
      p.email,
      p.avatar_url,
      p.university_affiliation,
      COALESCE(vs.min_visible_stage, 'idea') as min_visible_stage
    FROM public.team_members tm
    LEFT JOIN public.profiles p ON p.id = tm.user_id
    LEFT JOIN public.visibility_settings vs ON vs.user_id = tm.user_id AND vs.team_id = _team_id
    WHERE tm.team_id = _team_id
      AND tm.status = 'accepted'
      AND tm.user_id IS NOT NULL
  ),
  publication_counts AS (
    SELECT 
      pub.owner_id,
      pub.stage,
      COUNT(*) as count
    FROM public.publications pub
    WHERE pub.owner_id IN (SELECT user_id FROM member_data)
    GROUP BY pub.owner_id, pub.stage
  ),
  member_stats AS (
    SELECT 
      md.id,
      md.user_id as member_id,
      md.display_name,
      md.email,
      md.avatar_url,
      md.university_affiliation,
      md.role,
      md.min_visible_stage,
      COALESCE(
        jsonb_object_agg(
          pc.stage, 
          pc.count
        ) FILTER (WHERE pc.stage IS NOT NULL),
        '{}'::jsonb
      ) as publications_by_stage
    FROM member_data md
    LEFT JOIN publication_counts pc ON pc.owner_id = md.user_id
    GROUP BY md.id, md.user_id, md.display_name, md.email, md.avatar_url, 
             md.university_affiliation, md.role, md.min_visible_stage
  )
  SELECT jsonb_build_object(
    'members', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ms.id,
        'memberId', ms.member_id,
        'displayName', COALESCE(ms.display_name, ms.email, 'Unknown'),
        'email', ms.email,
        'avatarUrl', ms.avatar_url,
        'universityAffiliation', ms.university_affiliation,
        'role', ms.role,
        'minVisibleStage', ms.min_visible_stage,
        'publicationsByStage', ms.publications_by_stage
      )
      ORDER BY 
        CASE WHEN ms.role = 'admin' THEN 0 ELSE 1 END,
        ms.display_name
    ), '[]'::jsonb)
  ) INTO result
  FROM member_stats ms;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_team_dashboard_data(uuid) TO authenticated;

-- Revoke from anon to ensure no anonymous access
REVOKE EXECUTE ON FUNCTION public.get_team_dashboard_data(uuid) FROM anon;