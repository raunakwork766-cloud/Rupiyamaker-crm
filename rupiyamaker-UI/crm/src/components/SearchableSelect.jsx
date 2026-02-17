import React, { useState, useEffect, useRef } from 'react';

const SearchableSelect = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select an option",
  searchPlaceholder = "Search options...",
  disabled = false,
  required = false,
  className = "",
  emptyMessage = "No options available",
  variant = "dark" // "dark" or "light"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef(null);

  // Filter options based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
      }
    }
  };

  const getSelectedLabel = () => {
    const selectedOption = options.find(option => option.value === value);
    return selectedOption ? selectedOption.label : '';
  };

  const getButtonStyles = () => {
    const baseStyles = "w-full px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between";
    
    if (disabled) {
      return `${baseStyles} bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed`;
    }
    
    if (variant === "light") {
      return `${baseStyles} bg-white text-black border-neutral-800 hover:border-sky-400 focus:border-sky-400 ${isOpen ? 'border-sky-400' : ''}`;
    }
    
    // Default dark variant
    return `${baseStyles} bg-neutral-800 text-white border-neutral-800 hover:border-sky-400 focus:border-sky-400 ${isOpen ? 'border-sky-400' : ''}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Main select button */}
      <div
        className={getButtonStyles()}
        onClick={toggleDropdown}
      >
        <span className={`flex-1 ${!value ? 'text-gray-400' : ''}`}>
          {value ? getSelectedLabel() : placeholder}
        </span>
        <svg 
          className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* Search input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:border-sky-400"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value || index}
                  className={`px-3 py-2 cursor-pointer text-black hover:bg-gray-100 ${
                    value === option.value ? 'bg-sky-50 text-sky-700 font-medium' : ''
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-500 text-center">
                {searchTerm ? `No results found for "${searchTerm}"` : emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
