export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import CallbackClient from './CallbackClient';

export default function Page() {
  // Keep this page server-side so route options are valid
  return <CallbackClient />;
}
