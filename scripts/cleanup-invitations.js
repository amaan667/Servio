// Cleanup script for staff invitations
// Run this in your browser console on the staff management page

async function cleanupInvitations() {
  try {
    console.log('🧹 Starting invitation cleanup...');
    
    const response = await fetch('/api/cleanup-invitations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Cleanup completed successfully!');
      console.log(`📊 Deleted ${data.deletedCount} cancelled invitations`);
      console.log('🔄 Please refresh the page to see the updated invitation list');
    } else {
      console.error('❌ Cleanup failed:', data);
    }
  } catch (error) {
    console.error('❌ Error running cleanup:', error);
  }
}

// Run the cleanup
cleanupInvitations();
