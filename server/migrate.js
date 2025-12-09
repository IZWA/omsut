const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'omsut.db');
const db = new sqlite3.Database(DB_PATH);

console.log('Starting database migration...');

db.serialize(() => {
  // Check if old columns exist
  db.all("PRAGMA table_info(user_stats)", (err, columns) => {
    if (err) {
      console.error('Error checking table:', err);
      db.close();
      return;
    }

    const columnNames = columns.map(col => col.name);
    console.log('Current columns:', columnNames);

    // Check if we need to migrate
    const hasOldColumns = columnNames.includes('current_streak') || columnNames.includes('best_streak');
    const hasNewColumns = columnNames.includes('daily_current_streak');

    if (hasNewColumns && !hasOldColumns) {
      console.log('✅ Database already migrated!');
      db.close();
      return;
    }

    if (hasNewColumns && hasOldColumns) {
      // Remove old columns (SQLite doesn't support DROP COLUMN easily, so we'll leave them)
      console.log('⚠️ Both old and new columns exist. Old columns will be ignored.');
      db.close();
      return;
    }

    if (!hasNewColumns) {
      console.log('Adding new streak columns...');
      
      // Add columns in sequence using serialize
      db.serialize(() => {
        db.run(`ALTER TABLE user_stats ADD COLUMN daily_current_streak INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding daily_current_streak:', err);
          } else {
            console.log('✅ Added daily_current_streak');
          }
        });

        db.run(`ALTER TABLE user_stats ADD COLUMN daily_best_streak INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding daily_best_streak:', err);
          } else {
            console.log('✅ Added daily_best_streak');
          }
        });

        db.run(`ALTER TABLE user_stats ADD COLUMN free_current_streak INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding free_current_streak:', err);
          } else {
            console.log('✅ Added free_current_streak');
          }
        });

        db.run(`ALTER TABLE user_stats ADD COLUMN free_best_streak INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding free_best_streak:', err);
          } else {
            console.log('✅ Added free_best_streak');
          }
        });

        // If old columns exist, migrate data
        if (hasOldColumns) {
          console.log('Migrating data from old columns...');
          db.run(`UPDATE user_stats SET 
            daily_current_streak = COALESCE(current_streak, 0),
            daily_best_streak = COALESCE(best_streak, 0)
          `, (err) => {
            if (err) {
              console.error('Error migrating data:', err);
            } else {
              console.log('✅ Data migrated successfully!');
            }
            
            console.log('\n🎉 Migration complete!');
            db.close();
          });
        } else {
          console.log('\n🎉 Migration complete!');
          db.close();
        }
      });
    }
  });
});
