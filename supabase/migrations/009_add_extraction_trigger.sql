-- Create function to invoke Edge Function for extraction
CREATE OR REPLACE FUNCTION trigger_extraction()
RETURNS TRIGGER 
SECURITY DEFINER -- Runs with privileges of the creator (you)
SET search_path = public, vault, net, extensions, pg_temp -- Secure search path
AS $$
DECLARE
  project_url text;
  secret_key text;
  request_id bigint;
BEGIN
  -- Only trigger for new items with 'pending' status
  IF NEW.extraction_status = 'pending' THEN
    
    -- 1. Get Project URL
    -- Try to get from settings, otherwise use fallback
    project_url := current_setting('app.supabase_url', true);
    
    IF project_url IS NULL THEN
      -- REPLACE THIS with your actual project URL (e.g. https://xyz.supabase.co)
      project_url := 'https://qsmnqbglckpshfhmwdlw.supabase.co'; 
    END IF;

    -- 2. Get Secret Key Securely from Vault
    -- Assumes you ran: select vault.create_secret('sb_secret_...', 'service_role_key');
    SELECT decrypted_secret INTO secret_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;

    -- Safety check
    IF secret_key IS NULL THEN
      RAISE EXCEPTION 'Secret key not found in Vault. Please run vault.create_secret() with name "service_role_key".';
    END IF;

    -- 3. Make async HTTP request to Edge Function
    -- Note: function relies on 'net' extension being enabled in Dashboard
    SELECT net.http_post(
      url := project_url || '/functions/v1/extract-item',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || secret_key
      ),
      body := jsonb_build_object('item_id', NEW.id::text)
    ) INTO request_id;

    RAISE NOTICE 'Triggered extraction for item % (request_id: %)', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires AFTER INSERT
DROP TRIGGER IF EXISTS on_item_insert_trigger_extraction ON items;
CREATE TRIGGER on_item_insert_trigger_extraction
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_extraction();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_extraction() IS 'Automatically invokes extract-item Edge Function when a new item is inserted with pending status';
