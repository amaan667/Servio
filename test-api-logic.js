// Test the API logic directly to see what's happening
// This will help debug the time window calculations

console.log('🔍 Testing API Logic...\n');

// Test 1: Current time and boundaries
const now = new Date();
const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
const todayStart = new Date(now);
todayStart.setHours(0, 0, 0, 0);

console.log('📅 Time Boundaries:');
console.log('  Current time:', now.toISOString());
console.log('  30 minutes ago:', thirtyMinutesAgo.toISOString());
console.log('  Start of today:', todayStart.toISOString());
console.log('');

// Test 2: Live orders window (what the API should use)
const liveWindow = {
  startUtcISO: thirtyMinutesAgo.toISOString(),
  endUtcISO: now.toISOString()
};

console.log('🟢 Live Orders Window:');
console.log('  startUtcISO:', liveWindow.startUtcISO);
console.log('  endUtcISO:', liveWindow.endUtcISO);
console.log('');

// Test 3: Earlier today window
const earlierTodayWindow = {
  startUtcISO: todayStart.toISOString(),
  endUtcISO: thirtyMinutesAgo.toISOString()
};

console.log('🟡 Earlier Today Window:');
console.log('  startUtcISO:', earlierTodayWindow.startUtcISO);
console.log('  endUtcISO:', earlierTodayWindow.endUtcISO);
console.log('');

// Test 4: History window
const historyWindow = {
  startUtcISO: null,
  endUtcISO: todayStart.toISOString()
};

console.log('🔴 History Window:');
console.log('  startUtcISO:', historyWindow.startUtcISO);
console.log('  endUtcISO:', historyWindow.endUtcISO);
console.log('');

// Test 5: Check if the API response matches what we expect
console.log('🔍 Expected API Response:');
console.log('  Live orders should have count > 0 if orders exist in last 30 minutes');
console.log('  Earlier today should have count > 0 if orders exist today but >30 min ago');
console.log('  History should have count > 0 if orders exist before today');
console.log('');

console.log('💡 If API returns count: 0 for all, the issue is likely:');
console.log('  1. Orders are not PAID status');
console.log('  2. Orders are in wrong time windows');
console.log('  3. API time calculations are wrong');
console.log('  4. Database connection issue');
