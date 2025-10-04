// Simple test for ChalkTalk image generation
const fs = require('fs');
const path = require('path');

console.log('🧪 ChalkTalk Image Generation Test');
console.log('================================\n');

// Check if images directory exists
const imagesDir = path.join(__dirname, 'public', 'images', 'generated');
console.log('1️⃣ Checking images directory...');

if (fs.existsSync(imagesDir)) {
  console.log('✅ Images directory exists');
  
  // List existing images
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
  });
  
  console.log(`📁 Found ${imageFiles.length} image files:`);
  imageFiles.forEach((file, index) => {
    const filepath = path.join(imagesDir, file);
    const stats = fs.statSync(filepath);
    console.log(`   ${index + 1}. ${file} (${stats.size} bytes)`);
  });
} else {
  console.log('❌ Images directory does not exist');
  console.log('💡 Run the app first to generate some images');
}

// Test API endpoints
console.log('\n2️⃣ Testing API endpoints...');

async function testAPI() {
  try {
    // Test images list endpoint
    const response = await fetch('http://localhost:3000/api/images');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Images API working');
      console.log(`📊 API reports ${data.count} images`);
    } else {
      console.log('❌ Images API not working');
    }
  } catch (error) {
    console.log('⚠️ Cannot test API (server not running?)');
    console.log('💡 Start the server with: npm run dev');
  }
}

testAPI();

console.log('\n3️⃣ Instructions:');
console.log('   1. Start the server: npm run dev');
console.log('   2. Open http://localhost:3000');
console.log('   3. Use a test prompt to generate a storyboard');
console.log('   4. Check if images appear in the storyboard');
console.log('   5. Run this test again to see generated images');

console.log('\n🏁 Test complete!');
