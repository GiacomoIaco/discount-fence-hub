-- Check for auth.users trigger
SELECT
    tgname as trigger_name,
    proname as function_name,
    tgtype,
    tgenabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth' AND c.relname = 'users';

-- Check for user_profiles trigger
SELECT
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'user_profiles';

-- Also check the function that creates profiles
SELECT proname, prosrc
FROM pg_proc
WHERE proname LIKE '%user%profile%' OR proname LIKE '%new_user%' OR proname LIKE '%auth%user%';
