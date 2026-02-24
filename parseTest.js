// Simulate the parsing logic for Adesh in the screenshot
// Data says: IN "10:15:54 AM", OUT "07:25:52 PM"
import fs from 'fs';
const content = fs.readFileSync('/www/wwwroot/RupiyaMe/rupiyamaker-UI/crm/src/data.js', 'utf8');

const loginParsed = "10:15:54 AM";
const logoutParsed = "07:25:52 PM";

function parseDisplayTime(val) {
    if (!val) return { display: '—', minutes: 0 };
    const s = String(val).trim();
    const dtm = s.match(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i);
    if(dtm && s.length > dtm[1].length){
        return parseDisplayTime(dtm[1].trim());
    }
    const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
    if (m12) {
        let h = parseInt(m12[1]), mn = parseInt(m12[2]);
        const ap = m12[3].toUpperCase();
        if (ap === 'AM' && h === 12) h = 0;
        else if (ap === 'PM' && h !== 12) h += 12;
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return {
            display: `${String(h12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${ap}`,
            minutes: h * 60 + mn,
        };
    }
    return { display: s, minutes: 0 };
}

console.log("LOGIN", parseDisplayTime("24th Feb 2026 10:15:54 AM"));
console.log("LOGOUT", parseDisplayTime("24th Feb 2026 07:25:52 PM"));
