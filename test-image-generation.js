// Test script for ChalkTalk image generation system
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  testPrompt: "A young girl named Maya discovers a magical garden behind her school. She meets talking animals who teach her about photosynthesis and how plants make their own food.",
  expectedScenes: 6,
  imagesDir: path.join(__dirname, 'public', 'images', 'generated')
};

// Test functions
async function testImageStorage() {
  console.log('🧪 Testing Image Storage System...\n');
  
  try {
    // Test 1: Check if images directory exists
    console.log('1️⃣ Checking images directory...');
    if (fs.existsSync(TEST_CONFIG.imagesDir)) {
      console.log('✅ Images directory exists:', TEST_CONFIG.imagesDir);
    } else {
      console.log('❌ Images directory does not exist, creating...');
      fs.mkdirSync(TEST_CONFIG.imagesDir, { recursive: true });
      console.log('✅ Created images directory');
    }
    
    // Test 2: Test API endpoint availability
    console.log('\n2️⃣ Testing API endpoints...');
    try {
      const response = await fetch('http://localhost:3000/api/images');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Images API endpoint working');
        console.log(`📊 Found ${data.count} existing images`);
      } else {
        console.log('⚠️ Images API endpoint not responding (server might not be running)');
      }
    } catch (error) {
      console.log('⚠️ Cannot test API endpoint (server might not be running)');
    }
    
    // Test 3: Test storyboard generation
    console.log('\n3️⃣ Testing storyboard generation...');
    try {
      const response = await fetch('http://localhost:3000/api/generate-storyboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: TEST_CONFIG.testPrompt }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Storyboard generation working');
        console.log(`📝 Generated ${data.storyboard.scenes.length} scenes`);
        
        // Test 4: Check if images were created
        console.log('\n4️⃣ Checking generated images...');
        const files = fs.readdirSync(TEST_CONFIG.imagesDir);
        const imageFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
        });
        
        console.log(`📁 Found ${imageFiles.length} image files in storage`);
        
        if (imageFiles.length > 0) {
          console.log('✅ Images are being generated and saved!');
          console.log('📋 Generated image files:');
          imageFiles.forEach((file, index) => {
            const filepath = path.join(TEST_CONFIG.imagesDir, file);
            const stats = fs.statSync(filepath);
            console.log(`   ${index + 1}. ${file} (${stats.size} bytes, created: ${stats.birthtime.toLocaleString()})`);
          });
        } else {
          console.log('❌ No image files found in storage');
        }
        
        // Test 5: Test individual image URLs
        console.log('\n5️⃣ Testing image URLs...');
        if (imageFiles.length > 0) {
          const testImage = imageFiles[0];
          try {
            const imageResponse = await fetch(`http://localhost:3000/api/images/${testImage}`);
            if (imageResponse.ok) {
              console.log(`✅ Image serving working: ${testImage}`);
              console.log(`📏 Image size: ${imageResponse.headers.get('content-length')} bytes`);
              console.log(`🎨 Content type: ${imageResponse.headers.get('content-type')}`);
            } else {
              console.log(`❌ Failed to serve image: ${testImage}`);
            }
          } catch (error) {
            console.log(`⚠️ Cannot test image serving: ${error.message}`);
          }
        }
        
        // Test 6: Validate storyboard structure
        console.log('\n6️⃣ Validating storyboard structure...');
        const storyboard = data.storyboard;
        
        console.log(`📊 Storyboard validation:`);
        console.log(`   - Scenes: ${storyboard.scenes.length} (expected: ${TEST_CONFIG.expectedScenes})`);
        console.log(`   - Characters: ${storyboard.characters.length}`);
        console.log(`   - Style: ${storyboard.style ? 'Present' : 'Missing'}`);
        console.log(`   - Narration: ${storyboard.narration ? 'Present' : 'Missing'}`);
        
        // Check if scenes have image URLs
        const scenesWithImages = storyboard.scenes.filter(scene => scene.imageUrl);
        console.log(`   - Scenes with images: ${scenesWithImages.length}/${storyboard.scenes.length}`);
        
        if (scenesWithImages.length === storyboard.scenes.length) {
          console.log('✅ All scenes have image URLs');
        } else {
          console.log('❌ Some scenes are missing image URLs');
        }
        
      } else {
        console.log('❌ Storyboard generation failed');
        const errorData = await response.text();
        console.log('Error details:', errorData);
      }
    } catch (error) {
      console.log('❌ Cannot test storyboard generation:', error.message);
      console.log('💡 Make sure the development server is running (npm run dev)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test image cleanup
function testImageCleanup() {
  console.log('\n🧹 Testing image cleanup...');
  
  try {
    const files = fs.readdirSync(TEST_CONFIG.imagesDir);
    console.log(`📁 Found ${files.length} files in images directory`);
    
    if (files.length > 0) {
      console.log('📋 Files in images directory:');
      files.forEach((file, index) => {
        const filepath = path.join(TEST_CONFIG.imagesDir, file);
        const stats = fs.statSync(filepath);
        const ageHours = (Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60);
        console.log(`   ${index + 1}. ${file} (${stats.size} bytes, ${ageHours.toFixed(1)} hours old)`);
      });
    } else {
      console.log('📁 Images directory is empty');
    }
  } catch (error) {
    console.error('❌ Cleanup test failed:', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 ChalkTalk Image Generation Test Suite');
  console.log('=====================================\n');
  
  await testImageStorage();
  testImageCleanup();
  
  console.log('\n🏁 Test Suite Complete!');
  console.log('\n💡 Tips:');
  console.log('   - Make sure to run "npm run dev" before testing');
  console.log('   - Check the browser at http://localhost:3000');
  console.log('   - Generated images are saved in public/images/generated/');
  console.log('   - Use the test prompts in the UI to generate storyboards');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, testImageStorage, testImageCleanup };
