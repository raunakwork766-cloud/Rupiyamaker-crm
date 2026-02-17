// Auto-save Test Component - Simple Debug Version
import React, { useState, useRef, useEffect } from 'react';

export default function AutoSaveTest({ onUpdate, leadData }) {
    const [value, setValue] = useState('test value');
    const [message, setMessage] = useState('');
    const [leadInfo, setLeadInfo] = useState('');
    const lastSavedValue = useRef('test value');

    // Display current lead data for debugging
    useEffect(() => {
        if (leadData) {
            setLeadInfo(JSON.stringify({
                id: leadData._id?.slice(-8) || 'N/A',
                data_code: leadData.data_code || 'N/A',
                first_name: leadData.first_name || 'N/A',
                last_name: leadData.last_name || 'N/A',
                phone: leadData.phone || 'N/A',
                city: leadData.city || leadData.dynamic_fields?.address?.city || 'N/A',
                updated_at: leadData.updated_at || 'N/A'
            }, null, 2));
        }
    }, [leadData]);

    const handleBlur = async () => {
        console.log('🔍 AutoSaveTest: Current value:', value);
        console.log('🔍 AutoSaveTest: Last saved value:', lastSavedValue.current);
        console.log('🔍 AutoSaveTest: Are they equal?', value === lastSavedValue.current);

        if (value === lastSavedValue.current) {
            setMessage('⏭️ No change detected');
            return;
        }

        setMessage('💾 Saving test field...');
        try {
            const testUpdate = { test_field: value };
            console.log('📤 AutoSaveTest: Calling onUpdate with:', testUpdate);
            
            const result = await onUpdate(testUpdate);
            console.log('📥 AutoSaveTest: onUpdate result:', result);
            
            if (result !== false) {
                lastSavedValue.current = value;
                setMessage('✅ Test save successful!');
            } else {
                setMessage('❌ Test save failed');
            }
        } catch (error) {
            console.error('❌ AutoSaveTest error:', error);
            setMessage('❌ Test save error: ' + error.message);
        }
    };

    return (
        <div className="p-4 border border-gray-300 rounded bg-white text-black">
            <h3 className="font-bold mb-2">🧪 Auto-save Debug Component</h3>
            
            <div className="mb-4">
                <label className="block font-bold mb-1">Test Auto-save Field:</label>
                <input
                    type="text"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onBlur={handleBlur}
                    className="border p-2 w-full"
                    placeholder="Type something and click outside"
                />
                <div className="mt-1 text-sm text-blue-600">{message}</div>
            </div>

            <div className="mb-4">
                <h4 className="font-bold mb-1">Current Lead Data:</h4>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                    {leadInfo}
                </pre>
            </div>

            <div className="text-xs text-gray-600">
                <p><strong>Debug Info:</strong></p>
                <p>• Change "Test Auto-save Field" above</p>
                <p>• Click outside to trigger save</p>
                <p>• Check console for detailed logs</p>
                <p>• Watch lead data above for changes</p>
            </div>
        </div>
    );
}
