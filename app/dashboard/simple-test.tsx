export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function SimpleTest() {
  console.log('[SIMPLE-TEST] This server component is running!');
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Simple Server Test</h1>
      <p>If you see this, the server component is working.</p>
      <p>Check console for: [SIMPLE-TEST] This server component is running!</p>
    </div>
  );
}
