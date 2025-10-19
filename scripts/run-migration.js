// Simple script to run the database migration
// This can be run from the browser console or as a one-time script

async function runMigration() {
  try {

    const data = await response.json();

    if (response.ok) {
    } else {
      console.error('❌ Migration failed:', data);
    }
  } catch (error) {
    console.error('❌ Error running migration:', error);
  }
}

// Run the migration
runMigration();
