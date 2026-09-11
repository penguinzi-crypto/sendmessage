// Supabase Configuration
const SUPABASE_URL = 'https://vhilxweyqygofhgysvon.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaWx4d2V5cXlnb2ZoZ3lzdm9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjcwMzcsImV4cCI6MjEwNDcwMzAzN30.AEiJHhJsNdRQXRczOySCNBNFq1KL7y4wLlfPVMcdd0A';

// Admin email — only this email can access the dashboard
const ADMIN_EMAIL = 'denzermmolina@gmail.com';

// Initialize Supabase client
// We attach the initialized client to window.supabase so all scripts (app.js, admin.js)
// can use `supabase.from(...)` and `supabase.auth` without name collision.
(function() {
  const lib = window.supabase;
  if (lib && typeof lib.createClient === 'function') {
    window.supabase = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabaseClient = window.supabase;
  }
})();
