import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase';

export default async function DebugCookiesPage() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  const supabase = await createServerSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug: Cookies & Session</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">All Cookies:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })), null, 2)}
        </pre>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Session Status:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify({
            hasSession: !!session,
            userId: session?.user?.id,
            email: session?.user?.email,
            error: error?.message,
          }, null, 2)}
        </pre>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Supabase Auth Cookies:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(
            allCookies
              .filter(c => c.name.includes('sb-') || c.name.includes('supabase'))
              .map(c => ({
                name: c.name,
                hasValue: !!c.value,
                length: c.value.length
              })),
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}

