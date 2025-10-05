"use client";

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Edit3, 
  Save, 
  X,
  RefreshCw,
  Eye,
  Download,
  PlusCircle
} from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'processing' | 'ready' | 'committing' | 'done' | 'error' | 'needs_review';

interface MenuItem {
  category: string;
  name: string;
  price: number;
  description?: string;
}

interface ParsedMenu {
  categories: Array<{
    name: string;
    items: MenuItem[];
  }>;
  pages: number;
  tokens: number;
  preview: string;
}

export default function UploadMenuCard({ venueId }: { venueId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedMenu | null>(null);
  const [editingItem, setEditingItem] = useState<{ categoryIndex: number; itemIndex: number; item: MenuItem } | null>(null);
  const [editedMenu, setEditedMenu] = useState<ParsedMenu | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>('');

  // Initialize edited menu when parsed data is ready
  const initializeEditedMenu = useCallback((parsedData: any) => {
    if (parsedData.categories) {
      setEditedMenu(parsedData);
    } else if (parsedData.items) {
      // Convert flat items array to categorized structure
      const categories: { [key: string]: MenuItem[] } = {};
      parsedData.items.forEach((item: MenuItem) => {
        if (!categories[item.category]) {
          categories[item.category] = [];
        }
        categories[item.category].push(item);
      });
      
      const categorizedMenu = {
        categories: Object.entries(categories).map(([name, items]) => ({ name, items })),
        pages: parsedData.pages || 1,
        tokens: parsedData.tokens || 0,
        preview: parsedData.preview || ''
      };
      setEditedMenu(categorizedMenu);
    }
  }, []);

  const onUpload = async () => {
    if (!file) return;
    
    setState('uploading');
    setError(null);
    setProcessingProgress('Uploading file...');
    
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('venue_id', venueId);
      
      const up = await fetch('/api/menu/upload', { method: 'POST', body: fd });
      const uj = await up.json();
      
      if (!up.ok || !uj?.ok) {
        throw new Error(uj?.error || 'Upload failed');
      }
      
      setUploadId(uj.upload_id);
      setState('processing');
      setProcessingProgress('Processing with AI...');
      
      const pr = await fetch('/api/menu/process', { 
        method: 'POST', 
        headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify({ upload_id: uj.upload_id }) 
      });
      
      const pj = await pr.json();
      
      if (!pr.ok || !pj?.ok) {
        if (pj?.error === 'Text not menu-like') {
          setState('needs_review');
          setError(`OCR detected this may not be a menu (confidence: ${pj?.score}/100). Please review the extracted text.`);
          setParsed({ 
            categories: [], 
            pages: 1, 
            tokens: 0, 
            preview: pj?.preview || 'No preview available' 
          });
          return;
        }
        throw new Error(pj?.error || 'Process failed');
      }
      
      setParsed(pj);
      initializeEditedMenu(pj);
      setState('ready');
      setProcessingProgress('');
      
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setState('error');
      setProcessingProgress('');
    }
  };

  const onCommit = async () => {
    if (!uploadId || !editedMenu) return;
    
    setState('committing');
    setError(null);
    
    try {
      const cr = await fetch('/api/menu/commit', { 
        method: 'POST', 
        headers: { 'content-type': 'application/json' }, 
        body: JSON.stringify({ upload_id: uploadId }) 
      });
      
      const cj = await cr.json();
      
      if (!cr.ok || !cj?.ok) {
        throw new Error(cj?.error || 'Commit failed');
      }
      
      setState('done');
      
    } catch (err: any) {
      setError(err.message || 'Commit failed');
      setState('error');
    }
  };

  const startEditing = (categoryIndex: number, itemIndex: number, item: MenuItem) => {
    setEditingItem({ categoryIndex, itemIndex, item });
  };

  const saveEdit = () => {
    if (!editingItem || !editedMenu) return;
    
    const newEditedMenu = { ...editedMenu };
    newEditedMenu.categories[editingItem.categoryIndex].items[editingItem.itemIndex] = editingItem.item;
    
    setEditedMenu(newEditedMenu);
    setEditingItem(null);
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const updateEditingItem = (field: keyof MenuItem, value: string | number) => {
    if (!editingItem) return;
    
    setEditingItem({
      ...editingItem,
      item: { ...editingItem.item, [field]: value }
    });
  };

  const removeItem = (categoryIndex: number, itemIndex: number) => {
    if (!editedMenu) return;
    
    const newEditedMenu = { ...editedMenu };
    newEditedMenu.categories[categoryIndex].items.splice(itemIndex, 1);
    
    // Remove empty categories
    newEditedMenu.categories = newEditedMenu.categories.filter(cat => cat.items.length > 0);
    
    setEditedMenu(newEditedMenu);
  };

  const addCategory = () => {
    if (!editedMenu) return;
    
    const newEditedMenu = { ...editedMenu };
    newEditedMenu.categories.push({ name: 'New Category', items: [] });
    
    setEditedMenu(newEditedMenu);
  };

  const addItem = (categoryIndex: number) => {
    if (!editedMenu) return;
    
    const newEditedMenu = { ...editedMenu };
    newEditedMenu.categories[categoryIndex].items.push({
      name: 'New Item',
      price: 0,
      category: newEditedMenu.categories[categoryIndex].name,
      description: ''
    });
    
    setEditedMenu(newEditedMenu);
  };

  const resetToOriginal = () => {
    if (parsed) {
      initializeEditedMenu(parsed);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload PDF Menu
        </CardTitle>
        <CardDescription className="text-gray-900">
          Upload, parse and preview a PDF menu. OCR is used only if needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="space-y-2">
          <Input 
            type="file" 
            accept="application/pdf" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
          />
          {file && (
            <div className="flex items-center gap-2 text-sm text-gray-900">
              <FileText className="h-4 w-4" />
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={onUpload} 
            disabled={!file || state === 'uploading' || state === 'processing'}
            className="flex-1"
          >
            {state === 'uploading' ? 'Uploading...' : 
             state === 'processing' ? 'Processing...' : 'Upload & Process'}
          </Button>
          
          {state === 'ready' && (
            <Button onClick={onCommit} disabled={state !== 'ready'}>
              Commit to Menu
            </Button>
          )}
        </div>

        {/* Progress Indicator */}
        {processingProgress && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {processingProgress}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {state === 'done' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>Menu successfully uploaded and processed!</AlertDescription>
          </Alert>
        )}

        {/* Menu Preview and Editing */}
        {editedMenu && editedMenu.categories.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Menu Preview</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetToOriginal}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reset
                </Button>
                <Button variant="outline" size="sm" onClick={addCategory}>
                  <PlusCircle className="h-4 w-4 mr-1" />
                  Add Category
                </Button>
              </div>
            </div>

            {/* Processing Stats */}
            <div className="flex gap-4 text-sm text-gray-900">
              <Badge variant="outline">
                <Eye className="h-3 w-3 mr-1" />
                {editedMenu.pages} pages processed
              </Badge>
              <Badge variant="outline">
                <FileText className="h-3 w-3 mr-1" />
                {editedMenu.tokens} tokens used
              </Badge>
            </div>

            {/* Categories and Items */}
            <div className="max-h-96 overflow-auto border rounded-lg p-4 space-y-4">
              {editedMenu.categories.map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{category.name}</h4>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => addItem(categoryIndex)}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {category.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
                        {editingItem?.categoryIndex === categoryIndex && 
                         editingItem?.itemIndex === itemIndex ? (
                          // Edit Mode
                          <div className="flex-1 flex gap-2">
                            <Input
                              value={editingItem.item.name}
                              onChange={(e) => updateEditingItem('name', e.target.value)}
                              placeholder="Item name"
                              className="flex-1"
                            />
                            <Input
                              type="number"
                              value={editingItem.item.price}
                              onChange={(e) => updateEditingItem('price', parseFloat(e.target.value) || 0)}
                              placeholder="Price"
                              className="w-20"
                            />
                            <Input
                              value={editingItem.item.description || ''}
                              onChange={(e) => updateEditingItem('description', e.target.value)}
                              placeholder="Description"
                              className="flex-1"
                            />
                            <Button size="sm" onClick={saveEdit}>
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          // Display Mode
                          <div className="flex-1 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{item.name}</div>
                              {item.description && (
                                <div className="text-sm text-gray-900">{item.description}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-green-600">£{item.price.toFixed(2)}</span>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => startEditing(categoryIndex, itemIndex, item)}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => removeItem(categoryIndex, itemIndex)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw Text Preview (for needs_review state) */}
        {state === 'needs_review' && parsed?.preview && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Extracted Text Preview</h3>
            <div className="max-h-40 overflow-auto border rounded p-3 text-sm bg-gray-50">
              <pre className="whitespace-pre-wrap">{parsed.preview}</pre>
            </div>
            <p className="text-sm text-gray-900">
              Review the extracted text above. If this looks like a menu, you can manually edit and commit it.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


