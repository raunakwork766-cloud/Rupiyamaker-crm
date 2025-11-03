import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { hasDeletePermission } from '../../utils/permissions';

/**
 * DeleteButton Component
 * A reusable delete button that shows only when user has delete permission
 * 
 * @param {Object} props
 * @param {string} props.module - Module name (e.g., 'leads', 'tasks', 'employees')
 * @param {Function} props.onDelete - Function to call when delete is confirmed
 * @param {string} props.itemName - Name of item being deleted (for confirmation)
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.size - Button size ('sm', 'md', 'lg')
 * @param {string} props.variant - Button variant ('icon', 'text', 'button')
 * @param {Object} props.confirmOptions - Custom confirmation options
 * @returns {JSX.Element|null} Delete button or null if no permission
 */
const DeleteButton = ({
  module,
  onDelete,
  itemName = 'item',
  disabled = false,
  className = '',
  size = 'md',
  variant = 'icon',
  confirmOptions = {}
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user has delete permission for this module
  const canDelete = hasDeletePermission(module);

  // Don't render if user doesn't have permission
  if (!canDelete) {
    return null;
  }

  const handleDelete = async () => {
    // Default confirmation options
    const defaultConfirmOptions = {
      title: `Delete ${itemName}`,
      message: `Are you sure you want to delete this ${itemName}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    };

    const options = { ...defaultConfirmOptions, ...confirmOptions };

    // Show confirmation dialog
    const confirmed = window.confirm(`${options.title}\n\n${options.message}`);
    
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await onDelete();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete item. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'h-6 w-6 p-1',
    md: 'h-8 w-8 p-1.5',
    lg: 'h-10 w-10 p-2'
  };

  // Icon size classes
  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  // Base classes
  const baseClasses = `
    inline-flex items-center justify-center
    transition-all duration-200
    ${disabled || isDeleting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
  `;

  // Variant-specific classes
  const variantClasses = {
    icon: `
      ${sizeClasses[size]}
      rounded-lg
      text-red-500 hover:text-red-700
      hover:bg-red-50 dark:hover:bg-red-900/20
      border border-transparent hover:border-red-200
      ${baseClasses}
    `,
    text: `
      px-3 py-1.5 text-sm font-medium
      text-red-600 hover:text-red-700
      hover:bg-red-50 dark:hover:bg-red-900/20
      rounded-md border border-transparent hover:border-red-200
      ${baseClasses}
    `,
    button: `
      px-4 py-2 text-sm font-medium
      bg-red-500 hover:bg-red-600 text-white
      rounded-lg shadow-sm hover:shadow-md
      border border-red-500 hover:border-red-600
      ${baseClasses}
    `
  };

  const buttonContent = () => {
    if (isDeleting) {
      return (
        <div className={`animate-spin rounded-full border-2 border-current border-t-transparent ${iconSizes[size]}`}></div>
      );
    }

    switch (variant) {
      case 'text':
        return (
          <>
            <Trash2 className={`${iconSizes[size]} mr-1`} />
            Delete
          </>
        );
      case 'button':
        return (
          <>
            <Trash2 className={`${iconSizes[size]} mr-2`} />
            Delete {itemName}
          </>
        );
      case 'icon':
      default:
        return <Trash2 className={iconSizes[size]} />;
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={disabled || isDeleting}
      className={`${variantClasses[variant]} ${className}`}
      title={`Delete ${itemName}`}
      aria-label={`Delete ${itemName}`}
    >
      {buttonContent()}
    </button>
  );
};

export default DeleteButton;