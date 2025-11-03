// ClockTimePicker.jsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

function ClockTimePicker({ initialTime, onSelectTime, onClose }) {
  const [selectedHour, setSelectedHour] = useState(0); // 0-23
  const [selectedMinute, setSelectedMinute] = useState(0); // 0-59
  const [isAm, setIsAm] = useState(true);
  const [mode, setMode] = useState("hour"); // 'hour' or 'minute'
  const [isDragging, setIsDragging] = useState(false);

  const clockRef = useRef(null);
  const clockCenter = useRef({ x: 0, y: 0 });
  const clockRadius = useRef(0);

  // Initialize state from initialTime prop
  useEffect(() => {
    const [timeStr, ampm] = initialTime.split(" ");
    let [h, m] = timeStr.split(":").map(Number);

    if (ampm === "PM" && h !== 12) {
      h += 12;
    } else if (ampm === "AM" && h === 12) {
      h = 0; // Midnight 00:xx
    }

    setSelectedHour(h);
    setSelectedMinute(m);
    setIsAm(ampm === "AM");
  }, [initialTime]);

  // Calculate clock dimensions for drag events
  useEffect(() => {
    if (clockRef.current) {
      const rect = clockRef.current.getBoundingClientRect();
      clockCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      clockRadius.current = rect.width / 2;
    }

    // Update clock dimensions on window resize
    const updateClockDimensions = () => {
      if (clockRef.current) {
        const rect = clockRef.current.getBoundingClientRect();
        clockCenter.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
        clockRadius.current = rect.width / 2;
      }
    };

    window.addEventListener('resize', updateClockDimensions);
    window.addEventListener('scroll', updateClockDimensions);

    return () => {
      window.removeEventListener('resize', updateClockDimensions);
      window.removeEventListener('scroll', updateClockDimensions);
    };
  }, [mode]); // Recalculate if mode changes (since inner elements might affect layout slightly)

  // Function to format 24-hour to 12-hour display
  const getDisplayHour = (hour24) => {
    let h = hour24 % 12;
    if (h === 0) h = 12; // 00:xx (midnight) and 12:xx (noon) should display as 12
    return h.toString().padStart(2, "0");
  };

  const getDisplayMinute = (minute) => {
    return minute.toString().padStart(2, "0");
  };

  const handleHourClick = useCallback((hourValue) => {
    let newHour24 = hourValue;
    if (!isAm && hourValue !== 12) { // If PM and not 12 PM
      newHour24 = hourValue + 12;
    } else if (isAm && hourValue === 12) { // If AM and 12 AM (midnight)
      newHour24 = 0;
    }
    setSelectedHour(newHour24);
    setMode("minute"); // Switch to minute selection after hour is chosen
  }, [isAm]);

  const handleMinuteClick = useCallback((minuteValue) => {
    setSelectedMinute(minuteValue);
  }, []);

  const handleToggleAmPm = useCallback(() => {
    setIsAm((prev) => {
      const newIsAm = !prev;
      let newHour24 = selectedHour;
      if (newIsAm && selectedHour >= 12) { // Switching to AM from PM
        newHour24 = selectedHour - 12;
      } else if (!newIsAm && selectedHour < 12) { // Switching to PM from AM
        newHour24 = selectedHour + 12;
      }
      setSelectedHour(newHour24);
      return newIsAm;
    });
  }, [selectedHour]);

  const handleOk = useCallback(() => {
    let finalHour = selectedHour;
    // Ensure finalHour is correctly mapped for display based on isAm
    if (isAm && finalHour >= 12 && finalHour < 24) { // If currently PM, but showing AM and hour is 12-23 (e.g. 13:00 PM displayed as 01:00 AM)
      finalHour = finalHour - 12; // Back to 0-11 range for AM
    } else if (!isAm && finalHour < 12) { // If currently AM, but showing PM and hour is 0-11 (e.g. 01:00 AM displayed as 01:00 PM)
      finalHour = finalHour + 12; // Forward to 12-23 range for PM
    }

    // Re-adjust for 12 AM (00:xx) and 12 PM (12:xx) display
    let displayHour = finalHour % 12;
    if (displayHour === 0) displayHour = 12;

    const finalTimeString = `${displayHour.toString().padStart(2, "0")}:${selectedMinute.toString().padStart(2, "0")} ${isAm ? "AM" : "PM"}`;
    onSelectTime(finalTimeString);
    onClose();
  }, [selectedHour, selectedMinute, isAm, onSelectTime, onClose]);


  // Dragging logic
  const getAngleFromCoordinates = useCallback((clientX, clientY) => {
    // Update clock dimensions in real-time for accurate positioning
    if (clockRef.current) {
      const rect = clockRef.current.getBoundingClientRect();
      clockCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    const dx = clientX - clockCenter.current.x;
    const dy = clientY - clockCenter.current.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI); // Angle in degrees
    angle = (angle + 90 + 360) % 360; // Adjust so 0 is at 12 o'clock, clockwise

    return angle;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent text selection while dragging

    const angle = getAngleFromCoordinates(e.clientX, e.clientY);

    if (mode === 'minute') {
      let newMinute = Math.round((angle / 360) * 60);
      newMinute = Math.round(newMinute / 5) * 5; // Snap to nearest 5 minutes
      if (newMinute >= 60) newMinute = 0; // Wrap around for 60
      setSelectedMinute(newMinute);
    } else { // Hour mode
      let newHour = Math.round((angle / 360) * 12);
      if (newHour === 0) newHour = 12; // Handle 0 as 12 on the clock face

      let hour24 = newHour;
      if (!isAm && newHour !== 12) { // If PM, convert to 24hr format except for 12 PM
        hour24 = newHour + 12;
      } else if (isAm && newHour === 12) { // If AM, 12 on clock face is 0 (midnight)
        hour24 = 0;
      }
      setSelectedHour(hour24);
    }
  }, [isDragging, mode, isAm, getAngleFromCoordinates]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Add haptic feedback for mobile devices
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }, [isDragging, handleMouseMove]);

  const handleMouseDown = useCallback((e) => {
    // Don't start drag if clicking directly on a number or if it's not the primary mouse button
    if (e.target.closest('.clock-number') || e.button !== 0) return;

    e.preventDefault(); // Prevent default drag behavior
    setIsDragging(true);
    
    // Update clock center immediately before starting drag
    if (clockRef.current) {
      const rect = clockRef.current.getBoundingClientRect();
      clockCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    
    // Immediately update time for initial click position
    handleMouseMove(e);
  }, [handleMouseMove, handleMouseUp]);


  // Touch events for mobile dragging
  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !e.touches[0]) return;
    e.preventDefault(); // Prevent scrolling while dragging
    
    const touch = e.touches[0];
    const angle = getAngleFromCoordinates(touch.clientX, touch.clientY);

    if (mode === 'minute') {
      let newMinute = Math.round((angle / 360) * 60);
      newMinute = Math.round(newMinute / 5) * 5;
      if (newMinute >= 60) newMinute = 0;
      setSelectedMinute(newMinute);
    } else {
      let newHour = Math.round((angle / 360) * 12);
      if (newHour === 0) newHour = 12;

      let hour24 = newHour;
      if (!isAm && newHour !== 12) {
        hour24 = newHour + 12;
      } else if (isAm && newHour === 12) {
        hour24 = 0;
      }
      setSelectedHour(hour24);
    }
  }, [isDragging, mode, isAm, getAngleFromCoordinates]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      
      // Add haptic feedback for mobile devices
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  }, [isDragging, handleTouchMove]);

  const handleTouchStart = useCallback((e) => {
    if (e.target.closest('.clock-number')) return;

    e.preventDefault(); // Prevent default touch behavior
    setIsDragging(true);
    
    // Update clock center immediately before starting drag
    if (clockRef.current) {
      const rect = clockRef.current.getBoundingClientRect();
      clockCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    if (e.touches[0]) {
      // Create a mock event for initial position update
      const mockEvent = {
        touches: [e.touches[0]]
      };
      handleTouchMove(mockEvent); // Update on initial touch
    }
  }, [handleTouchMove, handleTouchEnd]);


  // Digital Input Handlers
  const handleDigitalHourChange = useCallback((e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value)) value = 0;

    if (mode === 'hour') { // When editing the hour field
      // Map 12-hour input to 24-hour internal state based on AM/PM
      if (value < 1 || value > 12) value = 1; // Cap to 1-12 for display
      let hour24 = value;
      if (!isAm && value !== 12) { // PM (1-11) -> 13-23
        hour24 = value + 12;
      } else if (isAm && value === 12) { // 12 AM -> 0 (midnight)
        hour24 = 0;
      } else if (!isAm && value === 12) { // 12 PM -> 12 (noon)
        hour24 = 12;
      }
      setSelectedHour(hour24);
    }
  }, [isAm, mode]);

  const handleDigitalMinuteChange = useCallback((e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > 59) value = 59;
    setSelectedMinute(value);
  }, []);

  const handleDigitalBlur = useCallback((e) => {
    // Re-format on blur, ensures two digits
    const target = e.target;
    target.value = target.value.padStart(2, '0');
  }, []);


  const getRotation = (value, total, unit) => {
    // Correctly map 12-hour clock values to 0-360 degrees, with 12 at the top (0 degrees)
    if (unit === 'minute') {
      return (value / 60) * 360;
    } else if (unit === 'hour') {
      // For hour hand, 12 o'clock is 0/360 degrees. Each hour is 30 degrees.
      // Need to adjust for 0 (midnight) being 12 on the clock face.
      const displayHourForRotation = (selectedHour % 12 === 0 && !isAm) ? 12 : (selectedHour % 12 === 0 && isAm) ? 12 : selectedHour % 12;
      return (displayHourForRotation / 12) * 360;
    }
    return 0;
  };

  const handRotation = mode === 'minute'
    ? getRotation(selectedMinute, 60, 'minute')
    : getRotation(selectedHour, 12, 'hour');


  const renderClockNumbers = () => {
    const numbers = [];
    const rotationAdjustment = -90; // Adjust so 0/12 is at the top
    if (mode === 'minute') {
      for (let i = 0; i < 60; i += 5) {
        const angle = (i / 60) * 360 + rotationAdjustment;
        const radius = 90;
        const x = radius * Math.cos(angle * Math.PI / 180);
        const y = radius * Math.sin(angle * Math.PI / 180);

        const currentMinuteHighlight = selectedMinute === i;

        numbers.push(
          <div
            key={`min-${i}`}
            className={`clock-number absolute flex items-center justify-center font-semibold text-lg cursor-pointer transition-colors duration-100 ${
              currentMinuteHighlight ? 'bg-cyan-500 text-white' : 'text-black'
            }`}
            style={{
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
              left: '50%',
              top: '50%',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
            }}
            onClick={() => handleMinuteClick(i)}
          >
            {i.toString().padStart(2, '0')}
          </div>
        );
      }
    } else { // Hour mode
      for (let i = 1; i <= 12; i++) {
        const angle = (i / 12) * 360 + rotationAdjustment;
        const radius = 80;
        const x = radius * Math.cos(angle * Math.PI / 180);
        const y = radius * Math.sin(angle * Math.PI / 180);

        // Logic to highlight the correct hour number on the clock face (1-12)
        const currentHour24 = selectedHour;
        const displayHourOnClock = (currentHour24 === 0 || currentHour24 === 12) ? 12 : currentHour24 % 12;
        const highlight = displayHourOnClock === i;

        numbers.push(
          <div
            key={`hour-${i}`}
            className={`clock-number absolute flex items-center justify-center font-semibold text-lg cursor-pointer transition-colors duration-100 ${
              highlight ? 'bg-cyan-500 text-white' : 'text-black'
            }`}
            style={{
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
              left: '50%',
              top: '50%',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
            }}
            onClick={() => handleHourClick(i)}
          >
            {i}
          </div>
        );
      }
    }
    return numbers;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent bg-opacity-40"
      style={{ backdropFilter: "blur(2px)" }}
    >
      <div className="bg-white rounded-2xl shadow-2xl relative overflow-hidden w-80">
        {/* Top Display */}
        <div className="bg-cyan-600 text-white p-6 flex flex-col items-center">
          <div className="text-5xl font-bold flex">
            <input
              type="number"
              value={getDisplayHour(selectedHour)}
              onChange={handleDigitalHourChange}
              onBlur={handleDigitalBlur}
              min="1"
              max="12"
              className={`w-20 bg-transparent border-b-2 text-center focus:outline-none focus:border-white ${mode === 'hour' ? 'border-white' : 'border-transparent text-cyan-200'}`}
              onClick={() => setMode('hour')}
              style={{ caretColor: 'transparent' }} // Hide caret for better UX
            />
            <span>:</span>
            <input
              type="number"
              value={getDisplayMinute(selectedMinute)}
              onChange={handleDigitalMinuteChange}
              onBlur={handleDigitalBlur}
              min="0"
              max="59"
              className={`w-20 bg-transparent border-b-2 text-center focus:outline-none focus:border-white ${mode === 'minute' ? 'border-white' : 'border-transparent text-cyan-200'}`}
              onClick={() => setMode('minute')}
              style={{ caretColor: 'transparent' }}
            />
          </div>
          <div className="flex mt-2">
            <button
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                isAm ? "bg-white text-cyan-600" : "text-cyan-200"
              }`}
              onClick={handleToggleAmPm}
            >
              AM
            </button>
            <button
              className={`ml-2 px-3 py-1 rounded-full text-sm font-semibold ${
                !isAm ? "bg-white text-cyan-600" : "text-cyan-200"
              }`}
              onClick={handleToggleAmPm}
            >
              PM
            </button>
          </div>
        </div>

        {/* Clock Face */}
        <div
          ref={clockRef}
          className={`relative w-64 h-64 mx-auto my-6 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-200 select-none transition-all duration-200 ${
            isDragging ? 'border-cyan-400 shadow-lg bg-gray-50' : 'hover:border-gray-300 hover:shadow-md'
          }`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none', // Prevent default touch behaviors
          }}
        >
          {/* Inner circle */}
          <div className={`absolute w-4 h-4 bg-cyan-600 rounded-full z-10 transition-all duration-200 ${
            isDragging ? 'w-5 h-5 bg-cyan-500 shadow-lg' : ''
          }`}></div>
          
          {/* Hand */}
          <div
            className={`absolute bg-cyan-600 transform origin-bottom transition-all duration-200 ${
              isDragging ? 'bg-cyan-500 shadow-lg' : ''
            }`}
            style={{
              width: isDragging ? '3px' : '2px',
              height: mode === 'minute' ? '80px' : '60px', // Minute hand longer than hour hand
              bottom: '50%',
              left: isDragging ? 'calc(50% - 1.5px)' : 'calc(50% - 1px)',
              transform: `rotate(${handRotation}deg)`,
              transformOrigin: 'bottom',
              transition: isDragging ? 'width 0.1s ease, left 0.1s ease, background-color 0.1s ease' : 'transform 0.3s ease-out, width 0.1s ease, left 0.1s ease, background-color 0.1s ease',
              borderRadius: '2px',
              boxShadow: isDragging ? '0 2px 8px rgba(6, 182, 212, 0.3)' : 'none',
            }}
          >
            {/* Hand tip for better visibility */}
            <div 
              className={`absolute w-3 h-3 bg-cyan-600 rounded-full transform -translate-x-1/2 transition-all duration-200 ${
                isDragging ? 'w-4 h-4 bg-cyan-500' : ''
              }`} 
              style={{
                top: '-6px',
                left: '50%',
                boxShadow: isDragging ? '0 2px 6px rgba(6, 182, 212, 0.4)' : 'none',
              }}
            ></div>
          </div>
          
          {/* Drag hint text */}
          {!isDragging && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 opacity-70 pointer-events-none">
              Drag the needle or click numbers
            </div>
          )}
          
          {renderClockNumbers()}
        </div>

        {/* Buttons */}
        <div className="p-4 flex justify-end gap-4 border-t border-gray-200">
          <button
            className="px-4 py-2 text-cyan-600 font-bold rounded-lg hover:bg-gray-100 transition"
            onClick={onClose}
          >
            CANCEL
          </button>
          <button
            className="px-4 py-2 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 transition"
            onClick={handleOk}
          >
            OK
          </button>
        </div>
        <button
          className="absolute top-4 right-4 text-white hover:text-red-200 text-2xl font-bold"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default ClockTimePicker;