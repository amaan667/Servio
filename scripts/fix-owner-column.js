// Fix owner column name mismatch
// Run this in your browser console on the staff management page

async function fixOwnerColumn() {
  try {
    console.log('🔧 Starting owner column fix...');
    
    const response = await fetch('/api/fix-owner-column', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Owner column fix completed:', data);
      console.log('🔄 Please refresh the page and try inviting again');
    } else {
      console.error('❌ Owner column fix failed:', data);
    }
  } catch (error) {
    console.error('❌ Error running owner column fix:', error);
  }
}

// Run the fix
fixOwnerColumn();
