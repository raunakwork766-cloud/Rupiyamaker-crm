import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const CustomNotification = ({ 
    type = 'info', 
    title = '', 
    message = '', 
    isVisible = false, 
    onClose, 
    autoClose = true,
    duration = 4000,
    actions = null
}) => {
    const [visible, setVisible] = useState(isVisible);

    useEffect(() => {
        setVisible(isVisible);
        
        if (isVisible && autoClose) {
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            
            return () => clearTimeout(timer);
        }
    }, [isVisible, autoClose, duration]);

    const handleClose = () => {
        setVisible(false);
        if (onClose) {
            onClose();
        }
    };

    const getTypeConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <CheckCircle className="w-5 h-5" />,
                    bgColor: 'bg-green-50',
                    borderColor: 'border-green-200',
                    iconColor: 'text-green-600',
                    titleColor: 'text-green-800',
                    messageColor: 'text-green-700'
                };
            case 'error':
                return {
                    icon: <XCircle className="w-5 h-5" />,
                    bgColor: 'bg-red-50',
                    borderColor: 'border-red-200',
                    iconColor: 'text-red-600',
                    titleColor: 'text-red-800',
                    messageColor: 'text-red-700'
                };
            case 'warning':
                return {
                    icon: <AlertCircle className="w-5 h-5" />,
                    bgColor: 'bg-yellow-50',
                    borderColor: 'border-yellow-200',
                    iconColor: 'text-yellow-600',
                    titleColor: 'text-yellow-800',
                    messageColor: 'text-yellow-700'
                };
            default:
                return {
                    icon: <Info className="w-5 h-5" />,
                    bgColor: 'bg-blue-50',
                    borderColor: 'border-blue-200',
                    iconColor: 'text-blue-600',
                    titleColor: 'text-blue-800',
                    messageColor: 'text-blue-700'
                };
        }
    };

    const config = getTypeConfig();

    if (!visible) return null;

    return (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
            <div className={`max-w-md w-full ${config.bgColor} border ${config.borderColor} rounded-lg shadow-lg`}>
                <div className="p-4">
                    <div className="flex items-start">
                        <div className={`flex-shrink-0 ${config.iconColor}`}>
                            {config.icon}
                        </div>
                        <div className="ml-3 w-0 flex-1">
                            {title && (
                                <h3 className={`text-sm font-medium ${config.titleColor}`}>
                                    {title}
                                </h3>
                            )}
                            {message && (
                                <p className={`mt-1 text-sm ${config.messageColor} ${title ? 'mt-1' : 'mt-0'}`}>
                                    {message}
                                </p>
                            )}
                            {actions && (
                                <div className="mt-3 flex space-x-2">
                                    {actions}
                                </div>
                            )}
                        </div>
                        <div className="ml-4 flex-shrink-0 flex">
                            <button
                                className={`rounded-md inline-flex ${config.iconColor} hover:opacity-75 focus:outline-none`}
                                onClick={handleClose}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Notification Manager Hook
export const useCustomNotification = () => {
    const [notifications, setNotifications] = useState([]);

    const showNotification = ({ type, title, message, autoClose = true, duration = 4000, actions = null }) => {
        const id = Date.now() + Math.random();
        const newNotification = {
            id,
            type,
            title,
            message,
            autoClose,
            duration,
            actions,
            isVisible: true
        };

        setNotifications(prev => [...prev, newNotification]);

        if (autoClose) {
            setTimeout(() => {
                removeNotification(id);
            }, duration);
        }

        return id;
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(notification => notification.id !== id));
    };

    const success = (title, message, options = {}) => {
        return showNotification({ type: 'success', title, message, ...options });
    };

    const error = (title, message, options = {}) => {
        return showNotification({ type: 'error', title, message, autoClose: false, ...options });
    };

    const warning = (title, message, options = {}) => {
        return showNotification({ type: 'warning', title, message, ...options });
    };

    const info = (title, message, options = {}) => {
        return showNotification({ type: 'info', title, message, ...options });
    };

    const NotificationContainer = () => (
        <div className="fixed top-0 right-0 z-50 p-4 space-y-2">
            {notifications.map((notification, index) => (
                <div
                    key={notification.id}
                    style={{ animationDelay: `${index * 100}ms` }}
                    className="animate-in slide-in-from-right duration-300"
                >
                    <CustomNotification
                        {...notification}
                        onClose={() => removeNotification(notification.id)}
                    />
                </div>
            ))}
        </div>
    );

    return {
        success,
        error,
        warning,
        info,
        showNotification,
        removeNotification,
        NotificationContainer
    };
};

export default CustomNotification;
