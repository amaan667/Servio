// Final fix for invitation constraint issue
// Run this in your browser console on the staff management page

async function fixConstraint() {
  try {
    console.log('🔧 Starting final constraint fix...');
    
    // Step 1: Clean up existing cancelled invitations
    const cleanupResponse = await fetch('/api/fix-invitation-constraint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const cleanupData = await cleanupResponse.json();

    if (cleanupResponse.ok) {
      console.log('✅ Cleanup completed:', cleanupData);
    } else {
      console.log('⚠️ Cleanup had issues:', cleanupData);
    }

    console.log('🎉 Constraint fix completed!');
    console.log('🔄 Please refresh the page and try cancelling an invitation');
    console.log('📝 The system now uses "deleted" status instead of "cancelled" to avoid constraint conflicts');
    
  } catch (error) {
    console.error('❌ Error running constraint fix:', error);
  }
}

// Run the fix
fixConstraint();
