function parseDisplayTime(val) {
    if (val === '' || val === null || val === undefined) return { display: '—', minutes: 0 };
    if (typeof val === 'number') {
        const timeFrac = val > 1 ? val % 1 : val;
        const totalMin = Math.round(timeFrac * 1440);
        const h24 = Math.floor(totalMin / 60) % 24;
        const mn = totalMin % 60;
        const ap = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return {
            display: `${String(h12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${ap}`,
            minutes: h24 * 60 + mn,
        };
    }
    const s = String(val).trim();
    const dtm = s.match(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)$/i);
    if (dtm && s.length > dtm[1].length) {
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
    const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m24) {
        let h24 = parseInt(m24[1]), mn = parseInt(m24[2]);
        if (h24 >= 24) h24 = h24 % 24;
        const ap = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return { display: `${String(h12).padStart(2, '0')}:${String(mn).padStart(2, '0')} ${ap}`, minutes: h24 * 60 + mn };
    }
    return { display: s, minutes: 0 };
}

// Simulating logic from parseExcelFile row parsing
const rec = {
    loginTime: "24th Feb 2026 10:15:54 AM",
    logoutTime: "24th Feb 2026 07:25:52 PM"
};

const loginParsed  = parseDisplayTime(rec.loginTime);
const logoutParsed = parseDisplayTime(rec.logoutTime);

const parsed = {
    loginTime:  loginParsed.display,
    logoutTime: logoutParsed.display,
    loginMin:   (rec.loginMin  !== undefined && rec.loginMin  !== '') ? parseInt(rec.loginMin)  : loginParsed.minutes,
    logoutMin:  (rec.logoutMin !== undefined && rec.logoutMin !== '') ? parseInt(rec.logoutMin) : logoutParsed.minutes,
};

console.log(parsed);
