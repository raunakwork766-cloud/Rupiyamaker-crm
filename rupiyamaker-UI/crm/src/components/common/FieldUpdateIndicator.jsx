import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const FieldUpdateIndicator = ({ 
    fieldName, 
    isUpdating = false, 
    updateSuccess = null, 
    updateError = null,
    onClearStatus = null,
    position = 'right' // 'right', 'left', 'bottom'
}) => {
    const [showIndicator, setShowIndicator] = useState(false);

    useEffect(() => {
        if (isUpdating || updateSuccess !== null || updateError !== null) {
            setShowIndicator(true);
        }

        if (updateSuccess === true || updateError !== null) {
            const timer = setTimeout(() => {
                setShowIndicator(false);
                if (onClearStatus) {
                    onClearStatus();
                }
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [isUpdating, updateSuccess, updateError, onClearStatus]);

    if (!showIndicator) return null;

    const getPositionClasses = () => {
        switch (position) {
            case 'left':
                return 'absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full mr-2';
            case 'bottom':
                return 'absolute bottom-0 left-1/2 transform translate-y-full -translate-x-1/2 mt-2';
            default: // right
                return 'absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-full ml-2';
        }
    };

    const renderIndicator = () => {
        if (isUpdating) {
            return (
                <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs">
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Updating...
                </div>
            );
        }

        if (updateSuccess === true) {
            return (
                <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-md text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Updated!
                </div>
            );
        }

        if (updateError) {
            return (
                <div className="flex items-center bg-red-100 text-red-800 px-2 py-1 rounded-md text-xs max-w-32">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    <span className="truncate">Failed</span>
                </div>
            );
        }

        return null;
    };

    return (
        <div className={`${getPositionClasses()} z-10 pointer-events-none`}>
            {renderIndicator()}
        </div>
    );
};

// Higher-order component to wrap input fields with update indicators
export const withFieldUpdateIndicator = (WrappedComponent) => {
    return React.forwardRef(({ fieldName, onFieldUpdate, updateStatus, ...props }, ref) => {
        const [isUpdating, setIsUpdating] = useState(false);
        const [updateSuccess, setUpdateSuccess] = useState(null);
        const [updateError, setUpdateError] = useState(null);

        // Handle field updates with visual feedback
        const handleFieldUpdate = async (fieldName, value) => {
            setIsUpdating(true);
            setUpdateSuccess(null);
            setUpdateError(null);

            try {
                if (onFieldUpdate) {
                    await onFieldUpdate(fieldName, value);
                }
                setUpdateSuccess(true);
            } catch (error) {
                setUpdateError(error.message || 'Update failed');
            } finally {
                setIsUpdating(false);
            }
        };

        const clearStatus = () => {
            setUpdateSuccess(null);
            setUpdateError(null);
        };

        return (
            <div className="relative">
                <WrappedComponent
                    ref={ref}
                    {...props}
                    onBlur={(e) => {
                        if (props.onBlur) {
                            props.onBlur(e);
                        }
                        // Trigger update on blur
                        if (fieldName && e.target.value !== props.originalValue) {
                            handleFieldUpdate(fieldName, e.target.value);
                        }
                    }}
                />
                <FieldUpdateIndicator
                    fieldName={fieldName}
                    isUpdating={isUpdating}
                    updateSuccess={updateSuccess}
                    updateError={updateError}
                    onClearStatus={clearStatus}
                />
            </div>
        );
    });
};

export default FieldUpdateIndicator;
