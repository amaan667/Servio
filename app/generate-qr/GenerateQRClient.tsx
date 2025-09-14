"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Printer, Copy, Check, Download, Settings, X, Plus, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { siteOrigin } from "@/lib/site";

interface Props {
  venueId: string;
  venueName: string;
  activeTablesCount: number;
}

type QRType = 'table' | 'counter';

export default function GenerateQRClient({ venueId, venueName, activeTablesCount }: Props) {
  console.log('🔍 [QR CLIENT] ===== GenerateQRClient Component Initialized =====');
  console.log('🔍 [QR CLIENT] Props received:', {
    venueId,
    venueName,
    activeTablesCount: activeTablesCount
  });
  console.log('🔍 [QR CLIENT] Initial state values:', {
    loading: true, // Initial state
    selectedTables: [],
    selectedCounters: []
  });

  const searchParams = useSearchParams();

  // Parse URL parameters to get selected tables (only from URL, not localStorage)
  const getInitialTables = () => {
    if (typeof window !== 'undefined') {
      // Only check URL parameters - don't fall back to localStorage
      const tablesParam = searchParams?.get('tables');
      const tableParam = searchParams?.get('table');
      
      console.log('🔍 [QR CLIENT] URL params:', {
        tablesParam,
        tableParam,
        fullUrl: window.location.href
      });
      
      if (tablesParam) {
        // Multiple tables selected
        const tables = tablesParam.split(',').filter(Boolean);
        console.log('🔍 [QR CLIENT] Parsed multiple tables from URL:', tables);
        return tables;
      } else if (tableParam) {
        // Single table selected
        console.log('🔍 [QR CLIENT] Parsed single table from URL:', tableParam);
        console.log('🔍 [QR CLIENT] Single table decoded:', decodeURIComponent(tableParam));
        return [decodeURIComponent(tableParam)];
      }
    }
    console.log('🔍 [QR CLIENT] No tables found in URL - starting with empty state');
    return null; // Return null to indicate no specific tables were requested
  };

  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedCounters, setSelectedCounters] = useState<string[]>([]);
  const [qrType, setQrType] = useState<QRType>('table');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ activeTablesNow: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printSettings, setPrintSettings] = useState({
    qrSize: 150,
    qrPerPage: 4,
    includeInstructions: true,
    includeVenueInfo: true
  });
  const router = useRouter();

  // Function to persist selected tables to localStorage
  const persistSelectedTables = (tables: string[]) => {
    if (typeof window !== 'undefined') {
      const storageKey = `qr-selected-tables-${venueId}`;
      localStorage.setItem(storageKey, JSON.stringify(tables));
      console.log('🔍 [QR CLIENT] Persisted tables to localStorage:', tables);
    }
  };

  // Function to persist selected counters to localStorage
  const persistSelectedCounters = (counters: string[]) => {
    if (typeof window !== 'undefined') {
      const storageKey = `qr-selected-counters-${venueId}`;
      localStorage.setItem(storageKey, JSON.stringify(counters));
      console.log('🔍 [QR CLIENT] Persisted counters to localStorage:', counters);
    }
  };

  // Function to update selected tables and persist them
  const updateSelectedTables = (newTables: string[]) => {
    setSelectedTables(newTables);
    persistSelectedTables(newTables);
  };

  // Function to update selected counters and persist them
  const updateSelectedCounters = (newCounters: string[]) => {
    setSelectedCounters(newCounters);
    persistSelectedCounters(newCounters);
  };

  // Helper function to clean table names (remove "table" prefix if it exists)
  const cleanTableName = (tableName: string) => {
    // If the table name starts with "table " (case insensitive), remove it
    const cleaned = tableName.replace(/^table\s+/i, '');
    return cleaned;
  };

  // Helper function to clean counter names (remove "counter" prefix if it exists)
  const cleanCounterName = (counterName: string) => {
    // If the counter name starts with "counter " (case insensitive), remove it
    const cleaned = counterName.replace(/^counter\s+/i, '');
    return cleaned;
  };

  // Get current selection based on QR type
  const currentSelection = qrType === 'table' ? selectedTables : selectedCounters;
  
  // Ensure we always have a valid order URL with proper source parameter
  const orderUrl = currentSelection.length > 0 
    ? `${siteOrigin()}/order?venue=${venueId}&${qrType}=${currentSelection[0]}&source=${qrType}`
    : `${siteOrigin()}/order?venue=${venueId}&table=1&source=table`;

  console.log('🔍 [QR CLIENT] Order URL:', orderUrl);
  console.log('🔍 [QR CLIENT] QR Type:', qrType);
  console.log('🔍 [QR CLIENT] Selected tables:', selectedTables);
  console.log('🔍 [QR CLIENT] Selected counters:', selectedCounters);

  const handleCopy = async () => {
    try {
      if (currentSelection.length === 1) {
        // Copy the single item's URL
        const itemOrderUrl = `${siteOrigin()}/order?venue=${venueId}&${qrType}=${currentSelection[0]}`;
        await navigator.clipboard.writeText(itemOrderUrl);
      } else {
        // Copy all URLs in a formatted list
        const allUrls = currentSelection.map(itemNumber => {
          const cleanName = qrType === 'table' ? cleanTableName(itemNumber) : cleanCounterName(itemNumber);
          const label = qrType === 'table' ? 'Table' : 'Counter';
          return `${label} ${cleanName}: ${siteOrigin()}/order?venue=${venueId}&${qrType}=${itemNumber}`;
        }).join('\n');
        await navigator.clipboard.writeText(allUrls);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const addTable = () => {
    const tableName = prompt("Enter table name or number (e.g., 1, 101, VIP-1):");
    if (tableName && tableName.trim()) {
      const trimmedName = tableName.trim();
      // Check if table already exists
      if (!selectedTables.includes(trimmedName)) {
        updateSelectedTables([...selectedTables, trimmedName]);
      } else {
        alert(`Table "${trimmedName}" is already added.`);
      }
    }
  };

  const addCounter = () => {
    const counterName = prompt("Enter counter name or number (e.g., 1, 2, Pickup-1):");
    if (counterName && counterName.trim()) {
      const trimmedName = counterName.trim();
      // Check if counter already exists
      if (!selectedCounters.includes(trimmedName)) {
        updateSelectedCounters([...selectedCounters, trimmedName]);
      } else {
        alert(`Counter "${trimmedName}" is already added.`);
      }
    }
  };

  const addMultipleTables = () => {
    const count = parseInt(prompt("How many tables would you like to add?") || "0");
    if (count > 0 && count <= 50) { // Limit to reasonable number
      const startNumber = selectedTables.length === 0 
        ? 1 
        : Math.max(...selectedTables.map(t => parseInt(t) || 0), 0) + 1;
      const newTables = Array.from({length: count}, (_, i) => (startNumber + i).toString());
      updateSelectedTables([...selectedTables, ...newTables]);
    }
  };

  const addMultipleCounters = () => {
    const count = parseInt(prompt("How many counters would you like to add?") || "0");
    if (count > 0 && count <= 50) { // Limit to reasonable number
      const startNumber = selectedCounters.length === 0 
        ? 1 
        : Math.max(...selectedCounters.map(c => parseInt(c) || 0), 0) + 1;
      const newCounters = Array.from({length: count}, (_, i) => (startNumber + i).toString());
      updateSelectedCounters([...selectedCounters, ...newCounters]);
    }
  };

  const clearAllTables = () => {
    // Clear all tables - start with empty state
    updateSelectedTables([]);
    console.log('🔍 [QR CLIENT] Cleared all tables, starting with empty state');
  };

  const clearAllCounters = () => {
    // Clear all counters - start with empty state
    updateSelectedCounters([]);
    console.log('🔍 [QR CLIENT] Cleared all counters, starting with empty state');
  };

  const removeTable = (tableNumber: string) => {
    const newTables = selectedTables.filter(t => t !== tableNumber);
    updateSelectedTables(newTables);
    console.log('🔍 [QR CLIENT] Removed table', tableNumber, 'remaining tables:', newTables);
  };

  const removeCounter = (counterNumber: string) => {
    const newCounters = selectedCounters.filter(c => c !== counterNumber);
    updateSelectedCounters(newCounters);
    console.log('🔍 [QR CLIENT] Removed counter', counterNumber, 'remaining counters:', newCounters);
  };

  const updateTableNumber = (oldTableNumber: string, newTableNumber: string) => {
    if (newTableNumber && !selectedTables.includes(newTableNumber)) {
      const newTables = selectedTables.map(t => t === oldTableNumber ? newTableNumber : t);
      updateSelectedTables(newTables);
    }
  };

  const handlePrint = () => {
    // Create a hidden iframe for printing instead of opening a new window
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    document.body.appendChild(printFrame);
    
    const printContent = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (printContent) {
      printContent.write(`
        <html>
          <head>
            <title>QR Code - ${qrType === 'table' ? 'Table' : 'Counter'} ${currentSelection[0]}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-after: always; }
                .no-break { page-break-inside: avoid; }
              }
              
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: white;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              
              .venue-name { 
                font-size: 28px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 10px;
              }
              
              .venue-subtitle { 
                font-size: 16px; 
                color: #666;
                margin-bottom: 20px;
              }
              
              .qr-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 40px; 
                margin-bottom: 40px;
              }
              
              .qr-item { 
                text-align: center; 
                padding: 20px; 
                border: 2px solid #ddd; 
                border-radius: 12px;
                background: white;
                page-break-inside: avoid;
              }
              
              .table-number { 
                font-size: 24px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 15px;
              }
              
              .qr-code { 
                margin: 15px 0; 
                display: flex;
                justify-content: center;
              }
              
              .qr-code img { 
                border: 1px solid #ccc;
                border-radius: 8px;
              }
              
              .scan-text { 
                font-size: 18px; 
                color: #666;
                margin-bottom: 10px;
              }
              
              .venue-info { 
                font-size: 16px; 
                color: #333;
                font-weight: 500;
              }
              
              .instructions { 
                margin-top: 40px; 
                padding: 20px; 
                background: #f8f9fa; 
                border-radius: 8px;
                border-left: 4px solid #007bff;
              }
              
              .instructions h3 { 
                color: #007bff; 
                margin-bottom: 15px;
              }
              
              .instructions ul { 
                margin: 0; 
                padding-left: 20px;
              }
              
              .instructions li { 
                margin-bottom: 8px; 
                color: #555;
              }
              
              .footer { 
                margin-top: 30px; 
                text-align: center; 
                color: #999; 
                font-size: 12px;
                border-top: 1px solid #eee;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="venue-name">${venueName || "My Venue"}</div>
              <div class="venue-subtitle">QR Code Ordering System</div>
            </div>
            
            <div class="qr-grid">
              <div class="qr-item">
                <div class="table-number">${qrType === 'table' ? 'Table' : 'Counter'} ${qrType === 'table' ? cleanTableName(currentSelection[0]) : cleanCounterName(currentSelection[0])}</div>
                <div class="qr-code">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=${printSettings.qrSize}x${printSettings.qrSize}&data=${encodeURIComponent(orderUrl)}&format=png&margin=2" alt="QR Code for ${qrType === 'table' ? 'Table' : 'Counter'} ${currentSelection[0]}" />
                </div>
                <div class="scan-text">Scan to order</div>
                <div class="venue-info">${venueName || "My Venue"}</div>
              </div>
            </div>
            
            ${printSettings.includeInstructions ? `
            <div class="instructions">
              <h3>Instructions for Customers:</h3>
              <ul>
                <li>Scan the QR code with your phone's camera</li>
                <li>Browse the menu and select your items</li>
                <li>Add special instructions if needed</li>
                <li>Complete your order and payment</li>
                <li>Your order will be prepared and served</li>
              </ul>
            </div>
            ` : ''}
            
            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p>Venue ID: ${venueId}</p>
            </div>
          </body>
        </html>
      `);
      printContent.close();
      
      // Print immediately - no artificial delay
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 500); // Reduced delay
    }
  };

  const handlePrintAll = () => {
    // Create a hidden iframe for printing instead of opening a new window
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    document.body.appendChild(printFrame);
    
    const printContent = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (printContent) {
      printContent.write(`
        <html>
          <head>
            <title>Multiple QR Codes - ${venueName}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-after: always; }
                .no-break { page-break-inside: avoid; }
              }
              
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: white;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 30px; 
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              
              .venue-name { 
                font-size: 28px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 10px;
              }
              
              .venue-subtitle { 
                font-size: 16px; 
                color: #666;
                margin-bottom: 20px;
              }
              
              .qr-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 30px; 
                margin-bottom: 40px;
              }
              
              .qr-item { 
                text-align: center; 
                padding: 15px; 
                border: 2px solid #ddd; 
                border-radius: 8px;
                background: white;
                page-break-inside: avoid;
              }
              
              .table-number { 
                font-size: 20px; 
                font-weight: bold; 
                color: #333;
                margin-bottom: 10px;
              }
              
              .qr-code { 
                margin: 10px 0; 
                display: flex;
                justify-content: center;
              }
              
              .qr-code img { 
                border: 1px solid #ccc;
                border-radius: 6px;
              }
              
              .scan-text { 
                font-size: 14px; 
                color: #666;
                margin-bottom: 8px;
              }
              
              .venue-info { 
                font-size: 14px; 
                color: #333;
                font-weight: 500;
              }
              
              .footer { 
                margin-top: 30px; 
                text-align: center; 
                color: #999; 
                font-size: 12px;
                border-top: 1px solid #eee;
                padding-top: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="venue-name">${venueName || "My Venue"}</div>
              <div class="venue-subtitle">QR Code Ordering System - ${qrType === 'table' ? 'Tables' : 'Counters'} ${currentSelection.join(', ')}</div>
            </div>
            
            ${currentSelection.map((itemNum, index) => {
              const itemOrderUrl = `${siteOrigin()}/order?venue=${venueId}&${qrType}=${itemNum}`;
              const cleanName = qrType === 'table' ? cleanTableName(itemNum) : cleanCounterName(itemNum);
              const label = qrType === 'table' ? 'Table' : 'Counter';
              return `
                <div class="qr-item">
                  <div class="table-number">${label} ${cleanName}</div>
                  <div class="qr-code">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=${printSettings.qrSize}x${printSettings.qrSize}&data=${encodeURIComponent(itemOrderUrl)}&format=png&margin=2" alt="QR Code for ${label} ${itemNum}" />
                  </div>
                  <div class="scan-text">Scan to order</div>
                  <div class="venue-info">${venueName || "My Venue"}</div>
                </div>
                ${(index + 1) % 4 === 0 && index < currentSelection.length - 1 ? '<div class="page-break"></div>' : ''}
              `;
            }).join('')}
            
            <div class="footer">
              <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
              <p>Venue ID: ${venueId}</p>
            </div>
          </body>
        </html>
      `);
      printContent.close();
      
      // Print immediately - no artificial delay
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 500); // Reduced delay
    }
  };

  useEffect(() => {
    const loadStats = () => {
      try {
        console.log('🔍 [QR CLIENT] ===== Starting loadStats =====');
        console.log('🔍 [QR CLIENT] loadStats inputs:', {
          venueId,
          activeTablesCount: activeTablesCount,
          activeTablesCountType: typeof activeTablesCount,
          activeTablesCountIsZero: activeTablesCount === 0,
          activeTablesCountIsNull: activeTablesCount === null,
          activeTablesCountIsUndefined: activeTablesCount === undefined
        });
        
        setLoading(true);
        setError(null);
        
        if (!venueId) {
          throw new Error('No venueId provided');
        }

        // Use the active tables count passed from server (from dashboard_counts function)
        const activeTables = activeTablesCount;
        console.log('🔍 [QR CLIENT] Using active tables count from server:', activeTables);

        setStats({ activeTablesNow: activeTables });
        
        // Check if tables were specified in URL parameters or localStorage
        const currentSelectedTables = getInitialTables();
        console.log('🔍 [QR CLIENT] getInitialTables() returned:', currentSelectedTables);
        
        if (currentSelectedTables === null) {
          // No tables in URL or localStorage - start with empty state
          setSelectedTables([]);
          persistSelectedTables([]);
          console.log('🔍 [QR CLIENT] No tables specified, starting with empty state');
        } else if (currentSelectedTables.length === 0) {
          // Empty array from localStorage - don't create any default tables
          setSelectedTables([]);
          persistSelectedTables([]);
          console.log('🔍 [QR CLIENT] Empty tables from localStorage, not creating any default tables');
        } else {
          // Tables were specified in URL or localStorage, keep them
          console.log('🔍 [QR CLIENT] Using tables from URL/localStorage:', currentSelectedTables.join(', '));
          setSelectedTables(currentSelectedTables);
        }
        
        console.log('🔍 [QR CLIENT] Final stats:', {
          activeTables,
          selectedTables: currentSelectedTables === null 
            ? (activeTables > 0 ? Array.from({length: activeTables}, (_, i) => (i + 1).toString()) : [])
            : currentSelectedTables
        });
        
        setLoading(false);
        console.log('🔍 [QR CLIENT] ===== loadStats completed successfully =====');
        console.log('🔍 [QR CLIENT] Final state after loadStats:', {
          loading: false,
          selectedTables: currentSelectedTables === null 
            ? (activeTables > 0 ? Array.from({length: activeTables}, (_, i) => (i + 1).toString()) : [])
            : currentSelectedTables,
          activeTables,
          currentSelectedTables
        });
      } catch (error: any) {
        console.error('🔍 [QR CLIENT] Error in loadStats:', error);
        setError(`Failed to load stats: ${error.message}`);
        // Set default values on error
        setStats({ activeTablesNow: 0 });
        setSelectedTables([]);
        setLoading(false);
      }
    };
    
    if (venueId) {
      loadStats();
    } else {
      console.log('🔍 [QR CLIENT] No venue ID provided, setting error');
      setError('No venue ID provided');
      setLoading(false);
    }
  }, [venueId, activeTablesCount]);

  // Effect to handle URL parameter changes
  useEffect(() => {
    const currentSelectedTables = getInitialTables();
    console.log('🔍 [QR CLIENT] URL params effect - current selected tables:', currentSelectedTables);
    
    if (currentSelectedTables !== null && currentSelectedTables.length > 0) {
      setSelectedTables(currentSelectedTables);
      // Don't persist URL-based table selections to localStorage to avoid conflicts
      console.log('🔍 [QR CLIENT] Updated selected tables from URL params (not persisting):', currentSelectedTables);
    } else if (currentSelectedTables === null) {
      // No specific tables in URL, start with empty state
      setSelectedTables([]);
      persistSelectedTables([]);
      console.log('🔍 [QR CLIENT] No tables in URL, starting with empty state from URL params effect');
    }
  }, [searchParams, venueId, activeTablesCount]);

  // Cleanup effect to clear localStorage when component unmounts
  useEffect(() => {
    return () => {
      // Clear localStorage when navigating away from QR page
      if (typeof window !== 'undefined') {
        const storageKey = `qr-selected-tables-${venueId}`;
        const counterStorageKey = `qr-selected-counters-${venueId}`;
        localStorage.removeItem(storageKey);
        localStorage.removeItem(counterStorageKey);
        console.log('🔍 [QR CLIENT] Cleared localStorage on component unmount');
      }
    };
  }, [venueId]);

  // Show loading state
  if (loading) {
    console.log('🔍 [QR CLIENT] Rendering loading state - loading is true');
    console.log('🔍 [QR CLIENT] Loading state details:', {
      loading,
      selectedTables,
      selectedCounters,
      activeTablesCount,
      venueId
    });
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="mt-2 text-muted-foreground">Loading QR codes...</p>
          <p className="text-xs text-muted-foreground mt-2">
            Debug: activeTablesCount={activeTablesCount}, venueId={venueId}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    console.log('🔍 [QR CLIENT] Rendering error state:', error);
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading QR Codes</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  console.log('🔍 [QR CLIENT] ===== Rendering main QR interface =====');
  console.log('🔍 [QR CLIENT] Current state:', {
    loading,
    error,
    stats,
    selectedTables,
    selectedCounters,
    qrType,
    currentSelection,
    venueId,
    venueName,
    activeTablesCount
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Tables Set Up</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{activeTablesCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Tables configured in your venue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>QR Code Settings</CardTitle>
            <CardDescription>
              Configure your QR code generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>QR Code Type</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  variant={qrType === 'table' ? 'default' : 'outline'}
                  onClick={() => setQrType('table')}
                  className="flex-1"
                >
                  Tables
                </Button>
                <Button
                  variant={qrType === 'counter' ? 'default' : 'outline'}
                  onClick={() => setQrType('counter')}
                  className="flex-1"
                >
                  Counters
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {qrType === 'table' 
                  ? 'Generate QR codes for table service (dine-in restaurants)' 
                  : 'Generate QR codes for counter service (food trucks, cafes, pickup)'
                }
              </p>
            </div>

            <div>
              <Label>{qrType === 'table' ? 'Table' : 'Counter'} Numbers</Label>
              <div className="mt-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {currentSelection.length === 0 
                      ? `No ${qrType}s selected - click the buttons below to add ${qrType}s for QR code generation`
                      : `Currently generating QR codes for ${currentSelection.length} active ${qrType}${currentSelection.length !== 1 ? 's' : ''}`
                    }
                  </div>
                  {currentSelection.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={qrType === 'table' ? clearAllTables : clearAllCounters}
                      className="text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>
                
                {currentSelection.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {currentSelection.map((itemNumber, index) => {
                      const cleanName = qrType === 'table' ? cleanTableName(itemNumber) : cleanCounterName(itemNumber);
                      const label = qrType === 'table' ? 'Table' : 'Counter';
                      return (
                        <Badge key={index} variant="outline" className="text-xs">
                          {label} {cleanName}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={qrType === 'table' ? addTable : addCounter}
                    className="flex-1"
                  >
                    + Add a {qrType === 'table' ? 'Table' : 'Counter'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={qrType === 'table' ? addMultipleTables : addMultipleCounters}
                    className="flex-1"
                  >
                    + Add Multiple {qrType === 'table' ? 'Tables' : 'Counters'}
                  </Button>
                </div>
                
              </div>
            </div>

            <div>
              <Label>Venue</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="font-medium">{venueName || "My Venue"}</p>
                <p className="text-sm text-muted-foreground">Venue ID: {venueId}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Label className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Print Settings
              </Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">QR Code Size:</span>
                  <select 
                    value={printSettings.qrSize} 
                    onChange={(e) => setPrintSettings(prev => ({...prev, qrSize: parseInt(e.target.value)}))}
                    className="text-sm border rounded px-2 py-1 bg-background text-foreground"
                  >
                    <option value={120}>Small (120px)</option>
                    <option value={150}>Medium (150px)</option>
                    <option value={200}>Large (200px)</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Include Instructions:</span>
                  <input 
                    type="checkbox" 
                    checked={printSettings.includeInstructions}
                    onChange={(e) => setPrintSettings(prev => ({...prev, includeInstructions: e.target.checked}))}
                    className="rounded"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Include Venue Info:</span>
                  <input 
                    type="checkbox" 
                    checked={printSettings.includeVenueInfo}
                    onChange={(e) => setPrintSettings(prev => ({...prev, includeVenueInfo: e.target.checked}))}
                    className="rounded"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR Code Preview</CardTitle>
            <CardDescription>
              Preview and download your QR codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currentSelection.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground mb-4">
                  <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-lg font-medium">No QR Codes Generated</p>
                  <p className="text-sm">
                    Select {qrType}s below to generate QR codes for your venue
                  </p>
                </div>
                <div className="flex flex-col gap-2 justify-center">
                  <div className="flex gap-2 justify-center">
                    <Button onClick={qrType === 'table' ? addTable : addCounter} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add a {qrType === 'table' ? 'Table' : 'Counter'}
                    </Button>
                    <Button onClick={qrType === 'table' ? addMultipleTables : addMultipleCounters} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Multiple {qrType === 'table' ? 'Tables' : 'Counters'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
                {currentSelection.map((itemNumber, index) => {
                  const itemOrderUrl = `${siteOrigin()}/order?venue=${venueId}&${qrType}=${itemNumber}`;
                  const cleanName = qrType === 'table' ? cleanTableName(itemNumber) : cleanCounterName(itemNumber);
                  const label = qrType === 'table' ? 'Table' : 'Counter';
                  return (
                    <div key={index} className="text-center p-2 sm:p-3 border rounded-lg bg-card relative">
                      <Button
                        onClick={() => qrType === 'table' ? removeTable(itemNumber) : removeCounter(itemNumber)}
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="bg-card p-2 rounded-lg shadow-sm inline-block">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=${Math.min(printSettings.qrSize, 120)}x${Math.min(printSettings.qrSize, 120)}&data=${encodeURIComponent(itemOrderUrl)}&format=png&margin=2`}
                          alt={`QR Code for ${label} ${itemNumber}`}
                          className="w-20 h-20 sm:w-24 sm:h-24"
                        />
                      </div>
                      <div className="mt-2">
                        <Badge variant="secondary">{label} {cleanName}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground break-all">
                        <code className="text-xs">{itemOrderUrl}</code>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {currentSelection.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handleCopy} variant="outline" className="flex-1">
                  {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? "Copied!" : currentSelection.length === 1 ? "Copy URL" : "Copy All URLs"}
                </Button>
                {currentSelection.length === 1 ? (
                  <Button onClick={handlePrint} variant="outline" className="flex-1">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Single
                  </Button>
                ) : (
                  <Button onClick={handlePrintAll} variant="default" className="flex-1">
                    <Printer className="mr-2 h-4 w-4" />
                    Print All {qrType === 'table' ? 'Tables' : 'Counters'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How to Use QR Codes</CardTitle>
          <CardDescription>
            Follow these steps to set up QR code ordering
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-semibold">1</span>
              </div>
              <div>
                <h4 className="font-medium">Generate QR Codes</h4>
                <p className="text-sm text-muted-foreground">
                  Create QR codes for tables (dine-in) or counters (pickup/food trucks) in your venue
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-semibold">2</span>
              </div>
              <div>
                <h4 className="font-medium">Print and Display</h4>
                <p className="text-sm text-muted-foreground">
                  Print the QR codes and place them on tables or at counter locations
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-semibold">3</span>
              </div>
              <div>
                <h4 className="font-medium">Customers Order</h4>
                <p className="text-sm text-muted-foreground">
                  Customers scan the QR code to view your menu and place orders for pickup or delivery
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
