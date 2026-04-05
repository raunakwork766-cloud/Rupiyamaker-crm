import { useEffect, useRef } from 'react';

/**
 * Hook that adds browser back-button support for modals/overlays.
 * When the modal opens, it pushes a history entry.
 * When the user presses back, it closes the modal instead of navigating away.
 * 
 * @param {boolean} isOpen - Whether the modal/overlay is currently open
 * @param {function} onClose - Function to call to close the modal
 */
export default function useModalHistory(isOpen, onClose) {
  const wasOpenRef = useRef(false);
  const closedByPopstateRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      // Modal just opened — push a history entry
      closedByPopstateRef.current = false;
      window.history.pushState({ modalOpen: true }, '');
    }

    if (wasOpen && !isOpen && !closedByPopstateRef.current) {
      // Modal closed programmatically (e.g. save button, X button) — NOT by back button
      // Go back to remove the history entry we pushed
      window.history.back();
    }

    closedByPopstateRef.current = false;
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (wasOpenRef.current) {
        // Modal is open and user pressed back — close it
        closedByPopstateRef.current = true;
        wasOpenRef.current = false;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
