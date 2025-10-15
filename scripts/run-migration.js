// Simple script to run the database migration
// This can be run from the browser console or as a one-time script

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');
    
    const response = await fetch('/api/migrate-database-constraint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Migration completed successfully!');
      console.log('📋 Response:', data);
    } else {
      console.error('❌ Migration failed:', data);
    }
  } catch (error) {
    console.error('❌ Error running migration:', error);
  }
}

// Run the migration
runMigration();
