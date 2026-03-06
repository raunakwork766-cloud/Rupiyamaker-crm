const EARLY_MIN = 1140; // 19:00 -> 19 * 60 = 1140

// If logout is 07:25:52 PM -> 19:25
// 19 * 60 + 25 = 1165
let logoutMin = 1165; 

// isEarly logic from data.js
let isEarly = logoutMin < EARLY_MIN; 
let earlyWaste = isEarly ? (EARLY_MIN - logoutMin) * 60 : 0;
let earlyMins = EARLY_MIN - logoutMin;

console.log("For 07:25 PM:");
console.log("isEarly:", isEarly);
console.log("earlyWaste:", earlyWaste);
console.log("earlyMins:", earlyMins);

// Wait, looking at the UI screenshot for Sandeep
// Login: 24th Feb 2026 10:26:26 AM
// Logout: 24th Feb 2026 07:26:10 PM
// But the UI shows a red "Login Duration" box. 
// Why is the login duration red? isLate = (loginMin > LATE_MIN), isEarly = (logoutMin < EARLY_MIN). sessOk = !isLate && !isEarly
// LATE_MIN = 630. 10:26 AM -> 10 * 60 + 26 = 626. So isLate = false.
// If the box is red, it MUST mean isEarly is true.
// But if logout is 19:26 PM -> 1166 min, isEarly should be false.
// So logoutMin is NOT 1166. It must be 0!
