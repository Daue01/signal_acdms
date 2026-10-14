import {createClient} from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured=Boolean(url&&anonKey);

// Keep imports safe during local setup; requests are gated by supabaseConfigured.
export const supabase=createClient(
  url??'https://placeholder.supabase.co',
  anonKey??'missing-anon-key',
  {
    auth:{
      // The callback page explicitly exchanges the confirmation code.
      // Keeping URL detection off prevents the browser client from racing
      // that exchange and consuming the one-time code first.
      flowType:'pkce',
      detectSessionInUrl:false,
    },
  },
);
