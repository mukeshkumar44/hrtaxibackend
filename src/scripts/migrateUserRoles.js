const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
  return runMigration();
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
  process.exit(1);
});

async function runMigration() {
  try {
    console.log('Starting user roles migration...');
    
    // Run the migration
    await User.migrateRoles();
    
    console.log('User roles migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}
