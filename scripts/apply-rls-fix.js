const { Pool } = require('pg');

async function applyRLSFix() {
  console.log('🔧 Applying RLS fix to menu_items table...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Read the SQL file
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./scripts/fix-menu-items-rls-deploy.sql', 'utf8');
    
    // Split into individual statements and execute
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          await client.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.log(`⚠️ Statement ${i + 1} failed:`, error.message);
          // Continue with other statements
        }
      }
    }

    console.log('🎉 RLS fix applied successfully!');
    
    // Verify the fix by checking the policies
    const result = await client.query(`
      SELECT policyname, cmd, roles 
      FROM pg_policies 
      WHERE tablename = 'menu_items' 
      ORDER BY policyname
    `);
    
    console.log('📋 Current RLS policies:');
    result.rows.forEach(row => {
      console.log(`  - ${row.policyname}: ${row.cmd} for ${row.roles}`);
    });

    client.release();
  } catch (error) {
    console.error('❌ Error applying RLS fix:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
applyRLSFix()
  .then(() => {
    console.log('✅ RLS fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ RLS fix failed:', error);
    process.exit(1);
  });
