import { createClient } from "@supabase/supabase-js";

// This client uses the SERVICE ROLE key and must only ever be imported from
// server-side code (API routes / route handlers). Never import this file
// from a "use client" component — that would leak the key to the browser.
let _client = null;

export function supabaseAdmin() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return _client;
}
