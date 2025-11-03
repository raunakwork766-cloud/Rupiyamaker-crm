import { useRef, useCallback } from 'react';

/**
 * Custom hook for debounced auto-save functionality
 * @param {Function} saveFunction - Function to call for saving data
 * @param {number} delay - Debounce delay in milliseconds (default: 1000ms)
 * @returns {Function} - Debounced save function
 */
export const useAutoSave = (saveFunction, delay = 1000) => {
    const timeoutRef = useRef(null);

    const debouncedSave = useCallback(
        (data) => {
            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout
            timeoutRef.current = setTimeout(() => {
                saveFunction(data);
            }, delay);
        },
        [saveFunction, delay]
    );

    // Cleanup timeout on unmount
    const cleanup = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    return { debouncedSave, cleanup };
};

/**
 * Custom hook for immediate auto-save on blur
 * @param {Function} saveFunction - Function to call for saving data
 * @param {Object} lastSavedData - Reference to last saved data to prevent unnecessary saves
 * @returns {Object} - Save handlers and loading state
 */
export const useBlurAutoSave = (saveFunction) => {
    const lastSavedData = useRef({});

    const handleFieldBlur = useCallback(
        async (field, currentData, setSaving, setMessage) => {
            // Only save if value changed
            if (currentData[field] === lastSavedData.current[field]) {
                return;
            }

            setSaving(true);
            try {
                await saveFunction(currentData);
                lastSavedData.current = { ...currentData };
                if (setMessage) {
                    setMessage('✅ Data saved successfully');
                    setTimeout(() => setMessage(''), 3000);
                }
            } catch (error) {
                console.error('Auto-save failed:', error);
                if (setMessage) {
                    setMessage('❌ Failed to save data');
                    setTimeout(() => setMessage(''), 3000);
                }
            } finally {
                setSaving(false);
            }
        },
        [saveFunction]
    );

    const updateLastSavedData = useCallback((data) => {
        lastSavedData.current = { ...data };
    }, []);

    return { handleFieldBlur, updateLastSavedData, lastSavedData };
};
