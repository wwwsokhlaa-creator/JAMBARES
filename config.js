window.JAMBARE_CONFIG = {
  SUPABASE_URL: "https://bjntikycmkojgthouadz.supabase.co",
  SUPABASE_KEY: "sb_publishable_uxVqnaVg33eYYNQViBHtpw_RZuVjCVE"
};
window.supabaseClient = window.supabase.createClient(
  window.JAMBARE_CONFIG.SUPABASE_URL,
  window.JAMBARE_CONFIG.SUPABASE_KEY
);
