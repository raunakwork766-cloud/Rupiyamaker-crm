/**
 * Test file for demonstrating the updated Navbar profile photo functionality
 * You can run these functions in the browser console to test localStorage integration
 */

// Import the utility functions
import { 
  updateProfilePhotoInStorage, 
  getProfilePhotoFromStorage, 
  clearProfilePhotoFromStorage,
  refreshNavbarProfilePhoto 
} from '../utils/profilePhotoUtils.js';

/**
 * Test functions for the profile photo functionality
 * These can be called from the browser console or used in other components
 */

// Test setting a profile photo
export const testSetProfilePhoto = () => {
  console.log('🧪 Testing profile photo update...');
  
  // Example photo path (replace with actual path)
  const testPhotoPath = 'media/profile_photos/test_user_123.jpg';
  
  const success = updateProfilePhotoInStorage(testPhotoPath);
  if (success) {
    console.log('✅ Test successful - profile photo should update in navbar');
  } else {
    console.log('❌ Test failed');
  }
};

// Test getting current profile photo
export const testGetProfilePhoto = () => {
  console.log('🧪 Testing profile photo retrieval...');
  
  const currentPhoto = getProfilePhotoFromStorage();
  console.log('Current profile photo:', currentPhoto);
  return currentPhoto;
};

// Test clearing profile photo
export const testClearProfilePhoto = () => {
  console.log('🧪 Testing profile photo clearing...');
  
  const success = clearProfilePhotoFromStorage();
  if (success) {
    console.log('✅ Test successful - profile photo should be cleared from navbar');
  } else {
    console.log('❌ Test failed');
  }
};

// Test forcing refresh
export const testRefreshNavbar = () => {
  console.log('🧪 Testing navbar refresh...');
  
  const success = refreshNavbarProfilePhoto();
  if (success) {
    console.log('✅ Test successful - navbar should refresh');
  } else {
    console.log('❌ Test failed - navbar refresh function not available');
  }
};

// Comprehensive test sequence
export const runAllTests = () => {
  console.log('🧪 Running comprehensive profile photo tests...');
  
  // 1. Check initial state
  console.log('\n1. Initial state:');
  testGetProfilePhoto();
  
  // 2. Set a test photo
  console.log('\n2. Setting test photo:');
  testSetProfilePhoto();
  
  // 3. Check updated state
  console.log('\n3. Updated state:');
  testGetProfilePhoto();
  
  // 4. Force refresh
  console.log('\n4. Force refresh:');
  testRefreshNavbar();
  
  // 5. Clear photo (after 3 seconds)
  setTimeout(() => {
    console.log('\n5. Clearing photo:');
    testClearProfilePhoto();
    
    // 6. Check final state
    setTimeout(() => {
      console.log('\n6. Final state:');
      testGetProfilePhoto();
    }, 1000);
  }, 3000);
};

// Manual localStorage operations for testing
export const manualTests = {
  // Directly set in localStorage (basic)
  setDirect: (photoPath) => {
    localStorage.setItem('profile_photo', photoPath);
    console.log('✅ Set profile_photo directly in localStorage');
  },
  
  // Set in user object
  setInUserObject: (photoPath) => {
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : {};
      user.profile_photo = photoPath;
      localStorage.setItem('user', JSON.stringify(user));
      console.log('✅ Set profile_photo in user object');
    } catch (error) {
      console.error('❌ Error setting in user object:', error);
    }
  },
  
  // Get current localStorage state
  checkState: () => {
    console.log('📋 Current localStorage state:');
    console.log('- profile_photo key:', localStorage.getItem('profile_photo'));
    try {
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      console.log('- user.profile_photo:', user?.profile_photo);
    } catch (error) {
      console.log('- user object: invalid JSON');
    }
  }
};

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  window.profilePhotoTests = {
    testSetProfilePhoto,
    testGetProfilePhoto,
    testClearProfilePhoto,
    testRefreshNavbar,
    runAllTests,
    manualTests
  };
  
  console.log('🧪 Profile photo tests available globally as window.profilePhotoTests');
  console.log('Example usage: window.profilePhotoTests.runAllTests()');
}
