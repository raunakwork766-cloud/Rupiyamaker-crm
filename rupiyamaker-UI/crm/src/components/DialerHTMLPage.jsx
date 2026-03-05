export default function DialerHTMLPage() {
    return (
        <iframe
            src={`/dialer.html?v=${Date.now()}`}
            title="Dialer Report"
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                minHeight: '100vh',
            }}
        />
    );
}
