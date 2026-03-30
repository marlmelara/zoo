-- Fix create_zoo_user RPC to actually set the role column
DROP FUNCTION IF EXISTS create_zoo_user(text,text,text,text,integer,text);

CREATE OR REPLACE FUNCTION create_zoo_user(
    email_param TEXT,
    password_param TEXT,
    first_name_param TEXT,
    last_name_param TEXT,
    department_id_param INT,
    role_param TEXT
)
RETURNS UUID AS $$
DECLARE
    new_user_uid UUID := gen_random_uuid();
BEGIN
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, recovery_sent_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', new_user_uid, 'authenticated', 'authenticated',
        email_param, crypt(password_param, gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', ''
    );

    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        new_user_uid, new_user_uid,
        format('{"sub":"%s","email":"%s"}', new_user_uid, email_param)::jsonb,
        'email', new_user_uid,
        now(), now(), now()
    );

    INSERT INTO employees (
        first_name, last_name, contact_info, dept_id, user_id,
        pay_rate_cents, shift_timeframe, role
    ) VALUES (
        first_name_param, last_name_param, email_param, department_id_param, new_user_uid,
        2000, '09:00-17:00', role_param
    );

    RETURN new_user_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activity log table for recording all transaction-type events
CREATE TABLE IF NOT EXISTS activity_log (
    log_id SERIAL PRIMARY KEY,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'supply_request_created',
        'supply_request_approved',
        'supply_request_denied',
        'supply_restocked',
        'employee_created',
        'employee_updated',
        'ticket_sold',
        'event_created',
        'donation_received',
        'medical_record_added',
        'animal_added',
        'inventory_updated'
    )),
    description TEXT NOT NULL,
    performed_by INT REFERENCES employees(employee_id),
    target_type TEXT,
    target_id INT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_performer ON activity_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
