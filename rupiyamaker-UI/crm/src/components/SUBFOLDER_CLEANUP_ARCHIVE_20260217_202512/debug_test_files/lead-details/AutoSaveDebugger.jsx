import React, { useState, useEffect } from 'react';

export default function AutoSaveDebugger({ leadData, onUpdate }) {
    const [testValue, setTestValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    useEffect(() => {
        console.log('🔍 AutoSaveDebugger: leadData updated:', leadData);
        setTestValue(leadData?.data_code || '');
    }, [leadData]);

    const handleBlur = async () => {
        if (!testValue || testValue === (leadData?.data_code || '')) {
            console.log('⏭️ AutoSaveDebugger: No change detected');
            return;
        }

        console.log('🚀 AutoSaveDebugger: Testing auto-save with value:', testValue);
        setIsSaving(true);
        setSaveMessage('Testing save...');

        try {
            const updateData = {
                data_code: testValue
            };
            
            const result = await onUpdate(updateData);
            console.log('📥 AutoSaveDebugger: Save result:', result);
            
            if (result !== false) {
                setSaveMessage('✅ Save successful!');
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                setSaveMessage('❌ Save failed');
                setTimeout(() => setSaveMessage(''), 3000);
            }
        } catch (error) {
            console.error('❌ AutoSaveDebugger: Save error:', error);
            setSaveMessage('❌ Save error: ' + error.message);
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="border border-blue-500 rounded-lg p-4 mb-4 bg-blue-50">
            <h3 className="text-lg font-bold text-blue-800 mb-2">Auto-Save Debugger</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                        Test Data Code (Change this to test auto-save)
                    </label>
                    <input
                        type="text"
                        value={testValue}
                        onChange={(e) => setTestValue(e.target.value)}
                        onBlur={handleBlur}
                        className="w-full border border-blue-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                        placeholder="Enter test data code..."
                        disabled={isSaving}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                        Current leadData.data_code
                    </label>
                    <div className="w-full border border-gray-300 rounded px-3 py-2 bg-gray-100 text-gray-600">
                        {leadData?.data_code || 'No data'}
                    </div>
                </div>
            </div>
            {(isSaving || saveMessage) && (
                <div className="mt-2 text-sm font-medium">
                    {isSaving ? '🔄 Saving...' : saveMessage}
                </div>
            )}
            <div className="mt-2 text-xs text-blue-600">
                Lead ID: {leadData?._id}<br/>
                Updated At: {leadData?.updated_at ? new Date(leadData.updated_at).toLocaleString() : 'Not set'}<br/>
                User ID: {localStorage.getItem('userId') || 'Not set'}<br/>
                Has Token: {localStorage.getItem('token') ? 'Yes' : 'No'}<br/>
                onUpdate Function: {onUpdate ? 'Available' : 'Missing'}
            </div>
        </div>
    );
}
