import { useState } from 'react';
import { message } from 'antd';
import hrmsService from '../services/hrmsService';

const usePostalLookup = () => {
    const [loading, setLoading] = useState(false);
    const [postalData, setPostalData] = useState(null);

    const lookupPincode = async (pincode) => {
        if (!pincode || pincode.length !== 6) {
            return null;
        }

        setLoading(true);
        try {
            const data = await hrmsService.lookupPincode(pincode);
            console.log('📍 Postal lookup result:', data);
            
            // Check if the API returned successful data
            if (data && data.success) {
                setPostalData(data);
                return data;
            } else {
                console.warn('Postal lookup failed:', data);
                message.warning(`Pincode ${pincode} not found. Please verify the pincode.`);
                return null;
            }
        } catch (error) {
            console.error('Error looking up pincode:', error);
            
            // Handle different types of errors
            if (error.message?.includes('not found')) {
                message.warning(`Pincode ${pincode} not found. Please verify the pincode.`);
            } else if (error.message?.includes('Network error')) {
                message.error('Network error. Please check your internet connection and try again.');
            } else {
                message.error('Failed to lookup pincode. Please check your internet connection.');
            }
            return null;
        } finally {
            setLoading(false);
        }
    };

    const clearData = () => {
        setPostalData(null);
    };

    return {
        loading,
        postalData,
        lookupPincode,
        clearData
    };
};

export default usePostalLookup;
