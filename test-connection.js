const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrtaxi';

console.log('Testing MongoDB connection...');
console.log('Connection string:', MONGODB_URI);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('✅ Successfully connected to MongoDB');
  process.exit(0);
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  process.exit(1);
});
