import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, RotateCcw, Bell, AlertTriangle, ClipboardList, Ticket, Loader2 } from 'lucide-react';

const API_BASE_URL = '/api';

const MODAL_TYPES = [
    { key: 'announcement', label: 'Announcements', description: 'Company-wide alerts', icon: '📢', color: 'red', borderColor: 'border-red-500', bgColor: 'bg-red-500/10', textColor: 'text-red-400' },
    { key: 'warning', label: 'Warnings', description: 'Violation or urgent alerts', icon: '⚠️', color: 'yellow', borderColor: 'border-yellow-500', bgColor: 'bg-yellow-500/10', textColor: 'text-yellow-400' },
    { key: 'task', label: 'Tasks Prompt', description: 'Pending callbacks & logs', icon: '📋', color: 'indigo', borderColor: 'border-indigo-500', bgColor: 'bg-indigo-500/10', textColor: 'text-indigo-400' },
    { key: 'ticket', label: 'Ticket Updates', description: 'Updates on open tickets', icon: '🎫', color: 'green', borderColor: 'border-green-500', bgColor: 'bg-green-500/10', textColor: 'text-green-400' },
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

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const uid = userId || localStorage.getItem('userId');
            const response = await axios.get(`${API_BASE_URL}/settings/popup-modal-settings?user_id=${uid}`);
            if (response.data?.success && response.data?.data?.modals) {
                setSettings(response.data.data.modals);
            } else {
                // Set defaults if no data from backend
                const defaults = {};
                MODAL_TYPES.forEach(m => {
                    defaults[m.key] = {
                        label: m.label,
                        description: m.description,
                        icon: m.icon,
                        force_accept: m.key === 'announcement',
                        max_cut_limit: m.key === 'announcement' ? 0 : m.key === 'warning' ? 1 : m.key === 'task' ? 2 : 3,
                        reappear_time: m.key === 'announcement' ? 0 : m.key === 'warning' ? 1 : m.key === 'task' ? 2 : 4,
                        reappear_unit: m.key === 'announcement' ? 'seconds' : 'hours',
                        enabled: true,
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

    const handleToggleEnabled = (modalKey) => {
        setSettings(prev => {
            const updated = { ...prev };
            updated[modalKey] = { ...updated[modalKey], enabled: !updated[modalKey].enabled };
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
            await axios.put(`${API_BASE_URL}/settings/popup-modal-settings?user_id=${uid}`, {
                modals: settings
            });
            setSaveMessage('Settings saved successfully!');
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
            <div className="flex items-center justify-center p-12">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
                <span className="ml-3 text-gray-400">Loading popup modal settings...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="border-b border-gray-700 pb-4">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Bell size={22} className="text-indigo-400" />
                    Agent Screen Popups
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Configure interaction rules, limits, and reappear logic for agent screen modals.
                </p>
            </div>

            {/* Modal Cards */}
            <div className="space-y-4">
                {MODAL_TYPES.map((modalType) => {
                    const modal = settings[modalType.key] || {};
                    const isForced = modal.force_accept;
                    const isEnabled = modal.enabled !== false;

                    return (
                        <div
                            key={modalType.key}
                            className={`bg-gray-800/60 border-l-4 ${modalType.borderColor} rounded-xl p-5 transition-all hover:bg-gray-800/90 hover:shadow-lg ${
                                !isEnabled ? 'opacity-50' : ''
                            }`}
                        >
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                {/* Left: Info */}
                                <div className="flex items-center gap-4 lg:w-1/4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${modalType.bgColor} border border-gray-700`}>
                                        {modalType.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-medium text-base">{modalType.label}</h3>
                                        <p className="text-gray-500 text-xs mt-0.5">{modalType.description}</p>
                                    </div>
                                </div>

                                {/* Right: Controls */}
                                <div className="flex flex-wrap items-center gap-6 lg:gap-8">
                                    {/* Enabled Toggle */}
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Enabled</span>
                                        <button
                                            onClick={() => handleToggleEnabled(modalType.key)}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                                isEnabled ? 'bg-green-500' : 'bg-gray-600'
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                                    isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Force Accept Toggle */}
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Force Accept</span>
                                        <button
                                            onClick={() => isEnabled && handleToggleForceAccept(modalType.key)}
                                            disabled={!isEnabled}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                                isForced ? 'bg-indigo-500' : 'bg-gray-600'
                                            } ${!isEnabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <span
                                                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                                    isForced ? 'translate-x-6' : 'translate-x-0.5'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Max Cut Limit */}
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Max Cut Limit</span>
                                        <input
                                            type="number"
                                            min="0"
                                            value={modal.max_cut_limit || 0}
                                            onChange={(e) => handleFieldChange(modalType.key, 'max_cut_limit', Math.max(0, parseInt(e.target.value) || 0))}
                                            disabled={isForced || !isEnabled}
                                            className="w-20 text-center bg-gray-900 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                            title={isForced ? 'Disabled when Force Accept is ON' : ''}
                                        />
                                    </div>

                                    {/* Reappear After */}
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Reappear After</span>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                value={modal.reappear_time || 0}
                                                onChange={(e) => handleFieldChange(modalType.key, 'reappear_time', Math.max(0, parseInt(e.target.value) || 0))}
                                                disabled={isForced || !isEnabled}
                                                className="w-16 text-center bg-gray-900 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                            />
                                            <select
                                                value={modal.reappear_unit || 'seconds'}
                                                onChange={(e) => handleFieldChange(modalType.key, 'reappear_unit', e.target.value)}
                                                disabled={isForced || !isEnabled}
                                                className="bg-gray-900 border border-gray-700 text-white rounded-lg px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                {TIME_UNITS.map(u => (
                                                    <option key={u.value} value={u.value}>{u.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Force Accept Info */}
                            {isForced && isEnabled && (
                                <div className="mt-3 flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 rounded-lg px-3 py-2">
                                    <AlertTriangle size={14} />
                                    <span>Force Accept is ON — User cannot dismiss this popup. It must be accepted.</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action Bar */}
            <div className="border-t border-gray-700 pt-4 flex items-center justify-between">
                <div>
                    {saveMessage && (
                        <span className={`text-sm ${saveMessage.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                            {saveMessage.includes('success') ? '✓' : '✗'} {saveMessage}
                        </span>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchSettings}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <RotateCcw size={16} />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PopupModalSettings;
