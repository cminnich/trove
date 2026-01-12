-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to invoke Edge Function for extraction
CREATE OR REPLACE FUNCTION trigger_extraction()
RETURNS TRIGGER AS $$
DECLARE
  project_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Only trigger for new items with 'pending' status
  IF NEW.extraction_status = 'pending' THEN
    -- Get Supabase project URL from environment
    -- This assumes SUPABASE_URL is available as a database setting
    -- You may need to hard-code your project URL here
    project_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.supabase_service_role_key', true);

    -- If settings not available, use a placeholder (will be configured in Supabase dashboard)
    IF project_url IS NULL THEN
      project_url := 'https://YOUR_PROJECT_REF.supabase.co';
    END IF;

    IF service_role_key IS NULL THEN
      service_role_key := 'YOUR_SERVICE_ROLE_KEY';
    END IF;

    -- Make async HTTP request to Edge Function
    -- This doesn't block the transaction
    SELECT net.http_post(
      url := project_url || '/functions/v1/extract-item',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('item_id', NEW.id::text)
    ) INTO request_id;

    -- Log the request (optional, for debugging)
    RAISE NOTICE 'Triggered extraction for item % (request_id: %)', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires AFTER INSERT
DROP TRIGGER IF EXISTS on_item_insert_trigger_extraction ON items;
CREATE TRIGGER on_item_insert_trigger_extraction
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_extraction();

-- Add comment for documentation
COMMENT ON FUNCTION trigger_extraction() IS 'Automatically invokes extract-item Edge Function when a new item is inserted with pending status';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION net.http_post TO postgres, anon, authenticated, service_role;
