import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

// accent border color per type — matches HTML mockup left-bar colors
const MODAL_TYPES = [
    {
        key: 'announcement',
        label: 'Announcements',
        description: 'Company-wide alerts',
        icon: '📢',
        iconColor: '#ff4757',
        accentColor: '#ff4757',   // --danger
    },
    {
        key: 'warning',
        label: 'Warnings',
        description: 'Violation or urgent alerts',
        icon: '⚠️',
        iconColor: '#ffa502',
        accentColor: '#ffa502',
    },
    {
        key: 'task',
        label: 'Tasks Prompt',
        description: 'Pending callbacks & logs',
        icon: '📋',
        iconColor: '#4e54c8',     // --primary
        accentColor: '#4e54c8',
    },
    {
        key: 'ticket',
        label: 'Ticket Updates',
        description: 'Updates on open tickets',
        icon: '🎫',
        iconColor: '#2ed573',     // --success
        accentColor: '#2ed573',
    },
];

const TIME_UNITS = [
    { value: 'seconds', label: 'Sec' },
    { value: 'minutes', label: 'Min' },
    { value: 'hours', label: 'Hrs' },
    { value: 'days', label: 'Days' },
];

const PopupModalSettings = ({ userId }) => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => { fetchSettings(); }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const uid = userId || localStorage.getItem('userId');
            const response = await axios.get(`${API_BASE_URL}/settings/popup-modal-settings?user_id=${uid}`);
            if (response.data?.success && response.data?.data?.modals) {
                setSettings(response.data.data.modals);
            } else {
                const defaults = {};
                MODAL_TYPES.forEach(m => {
                    defaults[m.key] = {
                        force_accept: m.key === 'announcement',
                        max_cut_limit: m.key === 'announcement' ? 0 : m.key === 'warning' ? 1 : m.key === 'task' ? 2 : 3,
                        reappear_time: m.key === 'announcement' ? 0 : m.key === 'warning' ? 1 : m.key === 'task' ? 2 : 4,
                        reappear_unit: m.key === 'announcement' ? 'seconds' : 'hours',
                    };
                });
                setSettings(defaults);
            }
        } catch (error) {
            console.error('Error fetching popup modal settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleForceAccept = (modalKey) => {
        setSettings(prev => {
            const updated = { ...prev };
            const modal = { ...updated[modalKey] };
            modal.force_accept = !modal.force_accept;
            if (modal.force_accept) {
                modal.max_cut_limit = 0;
                modal.reappear_time = 0;
                modal.reappear_unit = 'seconds';
            }
            updated[modalKey] = modal;
            return updated;
        });
        setHasChanges(true);
    };

    const handleFieldChange = (modalKey, field, value) => {
        setSettings(prev => {
            const updated = { ...prev };
            updated[modalKey] = { ...updated[modalKey], [field]: value };
            return updated;
        });
        setHasChanges(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const uid = userId || localStorage.getItem('userId');
            await axios.put(`${API_BASE_URL}/settings/popup-modal-settings?user_id=${uid}`, { modals: settings });
            setSaveMessage('✓ Configuration saved successfully');
            setHasChanges(false);
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Error saving popup modal settings:', error);
            setSaveMessage('Failed to save settings');
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 className="animate-spin" size={32} style={{ color: '#4e54c8' }} />
                <span style={{ marginLeft: '0.75rem', color: '#888' }}>Loading popup modal settings...</span>
            </div>
        );
    }

    return (
        <div style={{ fontFamily: "'Outfit', 'Inter', system-ui, sans-serif", color: '#f0f0f0' }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: '2rem', borderBottom: '1px solid #2a2a2a', paddingBottom: '1.5rem' }}>
                <h1 style={{
                    fontSize: '2rem',
                    fontWeight: 600,
                    background: 'linear-gradient(to right, #ffffff, #a0a0a0)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem',
                }}>
                    Agent Screen Popups
                </h1>
                <p style={{ color: '#888', fontSize: '1rem' }}>
                    Configure interaction rules, limits, and reappear logic for agent screen models.
                </p>
            </div>

            {/* ── Cards ── */}
            <div style={{ display: 'grid', gap: '1.5rem' }}>
                {MODAL_TYPES.map((mt) => {
                    const modal = settings[mt.key] || {};
                    const isForced = !!modal.force_accept;

                    return (
                        <div
                            key={mt.key}
                            style={{
                                background: '#121212',
                                border: '1px solid #2a2a2a',
                                borderRadius: '16px',
                                padding: '1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'all 0.3s ease',
                                cursor: 'default',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = '#1a1a1a';
                                e.currentTarget.style.borderColor = '#3a3a3a';
                                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = '#121212';
                                e.currentTarget.style.borderColor = '#2a2a2a';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            {/* Left accent bar */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                width: '4px',
                                height: '100%',
                                background: mt.accentColor,
                                borderRadius: '16px 0 0 16px',
                                opacity: 0.6,
                            }} />

                            {/* Card Info — 25% width */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', width: '25%' }}>
                                <div style={{
                                    width: '50px', height: '50px',
                                    borderRadius: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: mt.iconColor,
                                }}>
                                    {mt.icon}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 500, color: '#f0f0f0' }}>{mt.label}</h3>
                                    <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>{mt.description}</p>
                                </div>
                            </div>

                            {/* Card Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', flexGrow: 1, justifyContent: 'flex-end' }}>

                                {/* Force Accept */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                                        Force Accept
                                    </span>
                                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={isForced}
                                            onChange={() => handleToggleForceAccept(mt.key)}
                                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                        />
                                        <span style={{
                                            position: 'absolute',
                                            top: 0, left: 0, right: 0, bottom: 0,
                                            background: isForced ? '#4e54c8' : '#333',
                                            borderRadius: '34px',
                                            transition: '0.4s',
                                            boxShadow: isForced ? '0 0 10px rgba(78,84,200,0.4)' : 'none',
                                        }}>
                                            <span style={{
                                                position: 'absolute',
                                                height: '18px', width: '18px',
                                                left: isForced ? '28px' : '4px',
                                                bottom: '4px',
                                                background: 'white',
                                                borderRadius: '50%',
                                                transition: '0.3s',
                                            }} />
                                        </span>
                                    </label>
                                </div>

                                {/* Max Cut Limit */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                                        Max Cut Limit
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={modal.max_cut_limit ?? 0}
                                        onChange={e => handleFieldChange(mt.key, 'max_cut_limit', Math.max(0, parseInt(e.target.value) || 0))}
                                        disabled={isForced}
                                        title={isForced ? 'Disabled when Force Accept is ON' : ''}
                                        style={{
                                            width: '90px',
                                            textAlign: 'center',
                                            background: '#0a0a0a',
                                            border: '1px solid #333',
                                            color: '#fff',
                                            padding: '0.6rem 1rem',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            opacity: isForced ? 0.4 : 1,
                                            cursor: isForced ? 'not-allowed' : 'text',
                                            MozAppearance: 'textfield',
                                        }}
                                    />
                                </div>

                                {/* Reappear After */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                                        Reappear After
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            value={modal.reappear_time ?? 0}
                                            onChange={e => handleFieldChange(mt.key, 'reappear_time', Math.max(0, parseInt(e.target.value) || 0))}
                                            disabled={isForced}
                                            style={{
                                                width: '60px',
                                                textAlign: 'center',
                                                background: '#0a0a0a',
                                                border: '1px solid #333',
                                                color: '#fff',
                                                padding: '0.6rem 0.5rem',
                                                borderRadius: '8px',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                opacity: isForced ? 0.4 : 1,
                                                cursor: isForced ? 'not-allowed' : 'text',
                                                MozAppearance: 'textfield',
                                            }}
                                        />
                                        <select
                                            value={modal.reappear_unit || 'seconds'}
                                            onChange={e => handleFieldChange(mt.key, 'reappear_unit', e.target.value)}
                                            disabled={isForced}
                                            style={{
                                                background: '#0a0a0a',
                                                border: '1px solid #333',
                                                color: '#fff',
                                                padding: '0.6rem 1rem',
                                                borderRadius: '8px',
                                                fontSize: '0.95rem',
                                                outline: 'none',
                                                opacity: isForced ? 0.4 : 1,
                                                cursor: isForced ? 'not-allowed' : 'pointer',
                                            }}
                                        >
                                            {TIME_UNITS.map(u => (
                                                <option key={u.value} value={u.value}>{u.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Action Bar ── */}
            <div style={{
                marginTop: '3rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid #2a2a2a',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
            }}>
                {saveMessage && (
                    <span style={{
                        color: saveMessage.startsWith('✓') ? '#2ed573' : '#ff4757',
                        fontSize: '0.9rem',
                        marginRight: '1.5rem',
                    }}>
                        {saveMessage}
                    </span>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        background: 'linear-gradient(135deg, #4e54c8, #8f94fb)',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '1rem',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 15px rgba(78,84,200,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        opacity: saving ? 0.7 : 1,
                        transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={e => { if (!saving) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Save Configurations
                </button>
            </div>

        </div>
    );
};

export default PopupModalSettings;
