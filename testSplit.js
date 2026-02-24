        const str = "24th Feb 2026 10:15:54 AM";
        const match = str.match(/^(.+?)(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)$/);
        if (match) {
            console.log({ date: match[1].trim(), time: match[2].trim() });
        } else {
        const parts = str.split(' ');
        if (parts.length >= 2 && /\d{1,2}:\d{2}/.test(parts[parts.length - 1])) {
            const time = parts.pop();
            const ampm = /^(am|pm)$/i.test(parts[parts.length - 1]) ? parts.pop() : '';
            console.log({ date: parts.join(' '), time: ampm ? `${time} ${ampm}` : time });
        }
        else console.log({ date: str, time: '' });
        }
