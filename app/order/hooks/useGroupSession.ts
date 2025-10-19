import { useState, useEffect } from 'react';

export function useGroupSession(venueSlug: string, tableNumber: string, isCounterOrder: boolean) {
  const [showGroupSizeModal, setShowGroupSizeModal] = useState(false);
  const [showGroupSizePopup, setShowGroupSizePopup] = useState(false);
  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [showCustomGroupSize, setShowCustomGroupSize] = useState(false);
  const [customGroupSize, setCustomGroupSize] = useState<string>('');
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);

  useEffect(() => {
    const checkGroupSession = async () => {
      if (!venueSlug || !tableNumber) return;
      
      try {
        const response = await fetch(`/api/table/group-session?venueId=${venueSlug}&tableNumber=${tableNumber}`);
        if (response.ok) {
          const data = await response.json();
          if (data.groupSessionId) {
            setGroupSessionId(data.groupSessionId);
            setGroupSize(null);
            setShowGroupSizeModal(true);
          } else {
            setShowGroupSizeModal(true);
          }
        }
      } catch (error) {
        console.error('[ORDER PAGE] Error checking group session:', error);
        setShowGroupSizeModal(true);
      }
    };

    if (!isCounterOrder) {
      checkGroupSession();
    } else {
      setGroupSize(null);
      setShowGroupSizeModal(true);
    }
  }, [venueSlug, tableNumber, isCounterOrder]);

  const handleGroupSizeSubmit = async (selectedGroupSize: number) => {
    setGroupSize(selectedGroupSize);
    setShowGroupSizeModal(false);
    
    try {
      const response = await fetch('/api/table/group-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: venueSlug,
          tableNumber: tableNumber,
          groupSize: selectedGroupSize
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGroupSessionId(data.groupSessionId);
      }
    } catch (error) {
      console.error('[ORDER PAGE] Error creating group session:', error);
    }
  };

  const handleGroupSizeUpdate = async (newGroupSize: number) => {
    setGroupSize(newGroupSize);
    setShowGroupSizePopup(false);
    
    try {
      const response = await fetch('/api/table/group-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: venueSlug,
          tableNumber: tableNumber,
          groupSize: newGroupSize
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGroupSessionId(data.groupSessionId);
      }
    } catch (error) {
      console.error('[ORDER PAGE] Error updating group session:', error);
    }
  };

  return {
    showGroupSizeModal,
    setShowGroupSizeModal,
    showGroupSizePopup,
    setShowGroupSizePopup,
    groupSize,
    setGroupSize,
    showCustomGroupSize,
    setShowCustomGroupSize,
    customGroupSize,
    setCustomGroupSize,
    groupSessionId,
    handleGroupSizeSubmit,
    handleGroupSizeUpdate,
  };
}

