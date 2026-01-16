import { useState, useEffect } from "react";
import { safeGetItem, safeSetItem } from "../utils/safeStorage";

export function useGroupSession(
  venueSlug: string,
  tableNumber: string,
  isCounterOrder: boolean,
  skipModal: boolean = false
) {
  const [showGroupSizeModal, setShowGroupSizeModal] = useState(false);
  const [showGroupSizePopup, setShowGroupSizePopup] = useState(false);
  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [showCustomGroupSize, setShowCustomGroupSize] = useState(false);
  const [customGroupSize, setCustomGroupSize] = useState<string>("");
  const [groupSessionId, setGroupSessionId] = useState<string | null>(null);

  useEffect(() => {
    // If skipModal is true, don't show the modal at all
    if (skipModal) {
      // Still load cached group size if available
      if (typeof window !== "undefined") {
        const cached = safeGetItem(sessionStorage, `group_size_${venueSlug}_${tableNumber}`);
        if (cached) {
          setGroupSize(parseInt(cached));
        }
      }
      return;
    }

    // Check cache first for instant modal display
    const getCachedGroupSize = () => {
      if (typeof window === "undefined") return null;
      const cached = safeGetItem(sessionStorage, `group_size_${venueSlug}_${tableNumber}`);
      return cached ? parseInt(cached) : null;
    };

    const cachedSize = getCachedGroupSize();
    if (cachedSize) {
      setGroupSize(cachedSize);
      // Don't show modal if we have cached size
      return;
    }

    const checkGroupSession = async () => {
      if (!venueSlug || !tableNumber) return;

      try {
        const response = await fetch(
          `/api/table/group-session?venueId=${venueSlug}&tableNumber=${tableNumber}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.groupSessionId && data.groupSize) {
            setGroupSessionId(data.groupSessionId);
            setGroupSize(data.groupSize);
            // Cache group size (best-effort)
            if (typeof window !== "undefined") {
              safeSetItem(sessionStorage, `group_size_${venueSlug}_${tableNumber}`, String(data.groupSize));
            }
            // Don't show modal if session exists
            return;
          }
        }
      } catch (_error) {
        // Error handled silently
      }

      // Only show modal if no session exists
      if (!isCounterOrder) {
        setShowGroupSizeModal(true);
      }
    };

    if (!isCounterOrder) {
      checkGroupSession();
    } else {
      setGroupSize(null);
      setShowGroupSizeModal(true);
    }
  }, [venueSlug, tableNumber, isCounterOrder, skipModal]);

  const handleGroupSizeSubmit = async (selectedGroupSize: number) => {
    setGroupSize(selectedGroupSize);
    setShowGroupSizeModal(false);

    // Cache immediately for instant load next time (best-effort)
    if (typeof window !== "undefined") {
      safeSetItem(sessionStorage, `group_size_${venueSlug}_${tableNumber}`, String(selectedGroupSize));
    }

    try {
      const response = await fetch("/api/table/group-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venueSlug,
          tableNumber: tableNumber,
          groupSize: selectedGroupSize,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGroupSessionId(data.groupSessionId);
      }
    } catch (_error) {
      // Error silently handled
    }
  };

  const handleGroupSizeUpdate = async (newGroupSize: number) => {
    setGroupSize(newGroupSize);
    setShowGroupSizePopup(false);

    try {
      const response = await fetch("/api/table/group-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venueId: venueSlug,
          tableNumber: tableNumber,
          groupSize: newGroupSize,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGroupSessionId(data.groupSessionId);
      }
    } catch (_error) {
      // Error silently handled
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
