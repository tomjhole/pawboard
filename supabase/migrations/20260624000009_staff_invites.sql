-- =============================================================================
-- PawBoard — Staff invites + role management functions
-- Migration: 20260624000009_staff_invites.sql
-- =============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE staff_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        staff_role  NOT NULL DEFAULT 'staff',
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  token       uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz
);

-- Only one active (pending) invite per email per business
CREATE UNIQUE INDEX staff_invites_pending_email
  ON staff_invites (business_id, lower(email))
  WHERE accepted_at IS NULL;

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

-- Business members can view pending invites for their own business
CREATE POLICY "staff_invites_select" ON staff_invites
  FOR SELECT USING (business_id = get_current_business_id());

-- ── create_staff_invite ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_staff_invite(p_email text, p_role staff_role)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_caller_role staff_role;
  v_token       uuid;
BEGIN
  SELECT business_id, role INTO v_business_id, v_caller_role
  FROM staff_users
  WHERE id = auth.uid() AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a staff member.';
  END IF;

  IF v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can invite staff.';
  END IF;

  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite someone as an owner.';
  END IF;

  -- Already an active staff member?
  IF EXISTS (
    SELECT 1 FROM staff_users
    WHERE business_id = v_business_id
      AND lower(email) = lower(trim(p_email))
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'That email address already has access to this business.';
  END IF;

  -- Remove any existing pending invite for this email (allow re-invite)
  DELETE FROM staff_invites
  WHERE business_id = v_business_id
    AND lower(email) = lower(trim(p_email))
    AND accepted_at IS NULL;

  v_token := gen_random_uuid();
  INSERT INTO staff_invites (business_id, email, role, invited_by, token)
  VALUES (v_business_id, lower(trim(p_email)), p_role, auth.uid(), v_token);

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_staff_invite(text, staff_role) TO authenticated;

-- ── get_invite_by_token ───────────────────────────────────────────────────────
-- Callable without being a business member — token is the secret.

CREATE OR REPLACE FUNCTION get_invite_by_token(p_token uuid)
RETURNS TABLE (
  business_name text,
  email         text,
  role          staff_role,
  expires_at    timestamptz,
  is_valid      boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.name,
    i.email,
    i.role,
    i.expires_at,
    (i.accepted_at IS NULL AND i.expires_at > now())
  FROM staff_invites i
  JOIN businesses b ON b.id = i.business_id
  WHERE i.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION get_invite_by_token(uuid) TO authenticated;

-- ── accept_staff_invite ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_staff_invite(p_token uuid, p_first_name text, p_last_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite staff_invites%ROWTYPE;
  v_email  text;
BEGIN
  v_email := lower(auth.jwt() ->> 'email');

  SELECT * INTO v_invite
  FROM staff_invites
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite was not found, has already been used, or has expired.';
  END IF;

  IF v_invite.email != v_email THEN
    RAISE EXCEPTION 'This invite was sent to a different email address. Sign in with the address that received the invite.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM staff_users
    WHERE id = auth.uid() AND business_id = v_invite.business_id
  ) THEN
    RAISE EXCEPTION 'You already have access to this business.';
  END IF;

  INSERT INTO staff_users (id, business_id, role, first_name, last_name, email, invited_at)
  VALUES (
    auth.uid(),
    v_invite.business_id,
    v_invite.role,
    trim(p_first_name),
    trim(p_last_name),
    v_email,
    v_invite.created_at
  );

  UPDATE staff_invites SET accepted_at = now() WHERE id = v_invite.id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_staff_invite(uuid, text, text) TO authenticated;

-- ── update_staff_role ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_staff_role(p_staff_id uuid, p_new_role staff_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_caller_role staff_role;
BEGIN
  SELECT business_id, role INTO v_business_id, v_caller_role
  FROM staff_users
  WHERE id = auth.uid() AND is_active = true;

  IF NOT FOUND OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can change staff roles.';
  END IF;

  IF p_staff_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role.';
  END IF;

  UPDATE staff_users
  SET role = p_new_role
  WHERE id = p_staff_id AND business_id = v_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_staff_role(uuid, staff_role) TO authenticated;

-- ── set_staff_active ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_staff_active(p_staff_id uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_caller_role staff_role;
BEGIN
  SELECT business_id, role INTO v_business_id, v_caller_role
  FROM staff_users
  WHERE id = auth.uid() AND is_active = true;

  IF NOT FOUND OR v_caller_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can activate or deactivate staff.';
  END IF;

  IF p_staff_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot deactivate your own account.';
  END IF;

  UPDATE staff_users
  SET is_active = p_active
  WHERE id = p_staff_id AND business_id = v_business_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_staff_active(uuid, boolean) TO authenticated;
