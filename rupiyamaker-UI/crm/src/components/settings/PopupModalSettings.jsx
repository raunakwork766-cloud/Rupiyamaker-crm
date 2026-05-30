import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

const MODAL_TYPES = [
    {
        key: 'announcement',
        label: 'Announcements',
        description: 'Company-wide alerts',
        icon: '📢',
        iconColor: '#ff7a59',
        accentColor: '#ff7a59',
    },
    {
        key: 'warning',
        label: 'Warnings',
        description: 'Violation or urgent alerts',
        icon: '⚠️',
        iconColor: '#f5a623',
        accentColor: '#f5a623',
    },
    {
        key: 'task',
        label: 'Tasks Prompt',
        description: 'Pending callbacks & logs',
        icon: '📋',
        iconColor: '#00a4bd',
        accentColor: '#00a4bd',
    },
    {
        key: 'ticket',
        label: 'Ticket Updates',
        description: 'Updates on open tickets',
        icon: '🎫',
        iconColor: '#00bda5',
        accentColor: '#00bda5',
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
            setSaveMessage('Configuration saved successfully');
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
            <div className="hs-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 className="animate-spin" size={28} style={{ color: '#ff7a59' }} />
                <span style={{ marginLeft: '0.75rem', color: '#516f90' }}>Loading popup modal settings...</span>
            </div>
        );
    }

    return (
        <div className="hs-card">
            <div className="hs-card-header">
                <div>
                    <h3 className="hs-card-title">Agent Screen Popups</h3>
                    <p className="hs-card-subtitle">
                        Configure interaction rules, limits, and reappear logic for agent screen modals.
                    </p>
                </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'grid', gap: '1rem' }}>
                {MODAL_TYPES.map((mt) => {
                    const modal = settings[mt.key] || {};
                    const isForced = !!modal.force_accept;

                    return (
                        <div key={mt.key} className="hs-popup-card">
                            <div className="hs-popup-card-accent" style={{ background: mt.accentColor }} />

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px', paddingLeft: 8 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 3,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.25rem', background: '#f5f8fa',
                                    border: '1px solid #eaf0f6', color: mt.iconColor,
                                }}>
                                    {mt.icon}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#33475b' }}>{mt.label}</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: '#516f90' }}>{mt.description}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
                                <div>
                                    <span className="hs-popup-field-label">Force Accept</span>
                                    <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={isForced}
                                            onChange={() => handleToggleForceAccept(mt.key)}
                                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                        />
                                        <span style={{
                                            position: 'absolute', inset: 0,
                                            background: isForced ? '#ff7a59' : '#cbd6e2',
                                            borderRadius: 24, transition: '0.2s',
                                        }}>
                                            <span style={{
                                                position: 'absolute', height: 18, width: 18,
                                                left: isForced ? 22 : 3, top: 3,
                                                background: '#fff', borderRadius: '50%', transition: '0.2s',
                                            }} />
                                        </span>
                                    </label>
                                </div>

                                <div>
                                    <span className="hs-popup-field-label">Max Cut Limit</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="hs-popup-input"
                                        style={{ width: 80, textAlign: 'center' }}
                                        value={modal.max_cut_limit ?? 0}
                                        onChange={e => handleFieldChange(mt.key, 'max_cut_limit', Math.max(0, parseInt(e.target.value) || 0))}
                                        disabled={isForced}
                                    />
                                </div>

                                <div>
                                    <span className="hs-popup-field-label">Reappear After</span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            type="number"
                                            min="0"
                                            className="hs-popup-input"
                                            style={{ width: 64, textAlign: 'center' }}
                                            value={modal.reappear_time ?? 0}
                                            onChange={e => handleFieldChange(mt.key, 'reappear_time', Math.max(0, parseInt(e.target.value) || 0))}
                                            disabled={isForced}
                                        />
                                        <select
                                            className="hs-popup-input"
                                            value={modal.reappear_unit || 'seconds'}
                                            onChange={e => handleFieldChange(mt.key, 'reappear_unit', e.target.value)}
                                            disabled={isForced}
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

            <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #eaf0f6',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 16,
            }}>
                {saveMessage && (
                    <span style={{ color: saveMessage.includes('success') ? '#00a182' : '#f2545b', fontSize: 14 }}>
                        {saveMessage}
                    </span>
                )}
                <button type="button" onClick={handleSave} disabled={saving || !hasChanges} className="hs-btn-primary">
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    Save Configurations
                </button>
            </div>
        </div>
    );
};

export default PopupModalSettings;
