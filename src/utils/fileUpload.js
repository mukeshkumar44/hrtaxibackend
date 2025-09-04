const path = require('path');
const fs = require('fs');

const handleFileUpload = async (file, folder = 'uploads') => {
  try {
    if (!file) return null;
    
    const uploadDir = path.join(__dirname, `../public/${folder}`);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const filePath = path.join(uploadDir, fileName);
    
    // Move the file
    await file.mv(filePath);
    
    // Return the public URL
    return `/${folder}/${fileName}`;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

module.exports = { handleFileUpload };
