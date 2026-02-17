console.log('🧹 Clearing all cookies and localStorage...');

// Clear all cookies
document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

// Clear localStorage
localStorage.clear();

// Clear sessionStorage  
sessionStorage.clear();

console.log('✅ All cookies and storage cleared!');
console.log('🔄 Please refresh the page and try logging in again.');

alert('Cookies cleared! Please refresh and login again.');
