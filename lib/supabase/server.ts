import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Acts as the signed-in user (RLS applies). */
export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Called from a Server Component, which can't set cookies. proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
