import React, { useState, useEffect } from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { getProfilePictureUrlWithCacheBusting } from '../../utils/mediaUtils';

const ProfileAvatar = ({ 
    employee, 
    size = 32, 
    className = '',
    showFallback = true 
}) => {
    const [imageError, setImageError] = useState(false);
    
    // Reset imageError when employee or profile_photo changes
    useEffect(() => {
        setImageError(false);
    }, [employee?.profile_photo, employee?._id]);
    
    const profilePictureUrl = getProfilePictureUrlWithCacheBusting(employee?.profile_photo);
    const fullName = `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim();
    const initials = fullName
        .split(' ')
        .map(name => name.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2);

    // Debug logging
    if (employee?.profile_photo) {
        console.log('ProfileAvatar Debug:', {
            employeeName: fullName,
            originalPath: employee.profile_photo,
            fullUrl: profilePictureUrl,
            imageError
        });
    }

    // If profile picture exists and no error, show it
    if (profilePictureUrl && !imageError) {
        return (
            <Avatar
                size={size}
                src={profilePictureUrl}
                className={className}
                onError={(e) => {
                    console.error('Error loading profile picture for:', fullName, profilePictureUrl);
                    setImageError(true);
                    return false;
                }}
            >
                {showFallback && (initials || <UserOutlined />)}
            </Avatar>
        );
    }

    // If no profile picture or error, show initials or icon
    if (showFallback) {
        return (
            <Avatar
                size={size}
                className={`${className} bg-gradient-to-r from-blue-500 to-purple-600`}
                style={{ 
                    color: 'white',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {initials || <UserOutlined />}
            </Avatar>
        );
    }

    return null;
};

export default ProfileAvatar;
