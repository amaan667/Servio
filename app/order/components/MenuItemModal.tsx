"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MenuItem, ModifierGroup, SelectedModifier } from "../types";
import { ModifierGroupComponent } from "./ModifierGroupComponent";

interface MenuItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (item: MenuItem, quantity: number, selectedModifiers: SelectedModifier[], modifierPrice: number, specialInstructions: string) => void;
}

export function MenuItemModal({ item, onClose, onAddToCart }: MenuItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setQuantity(1);
      setSelectedModifiers([]);
      setSpecialInstructions("");
      setErrors({});
      
      // Pre-select default options
      if (item.modifier_groups) {
        const defaults: SelectedModifier[] = [];
        item.modifier_groups.forEach(group => {
          const defaultOptions = group.options.filter(opt => opt.isDefault);
          if (defaultOptions.length > 0) {
            defaults.push({
              groupId: group.id,
              groupName: group.name,
              options: defaultOptions.map(opt => ({
                id: opt.id,
                name: opt.name,
                price: opt.price,
              })),
            });
          }
        });
        setSelectedModifiers(defaults);
      }
    }
  }, [item]);

  if (!item) return null;

  const handleModifierChange = (groupId: string, groupName: string, optionId: string, optionName: string, optionPrice: number, isSelected: boolean, group: ModifierGroup) => {
    setSelectedModifiers(prev => {
      const existingGroupIndex = prev.findIndex(m => m.groupId === groupId);
      
      if (isSelected) {
        // Add selection
        if (existingGroupIndex >= 0) {
          // Group already has selections
          const existing = prev[existingGroupIndex];
          
          if (group.maxSelections === 1) {
            // Radio behavior - replace existing selection
            return [
              ...prev.slice(0, existingGroupIndex),
              {
                groupId,
                groupName,
                options: [{ id: optionId, name: optionName, price: optionPrice }],
              },
              ...prev.slice(existingGroupIndex + 1),
            ];
          } else {
            // Checkbox behavior - add if under max
            if (existing.options.length < group.maxSelections) {
              return [
                ...prev.slice(0, existingGroupIndex),
                {
                  ...existing,
                  options: [...existing.options, { id: optionId, name: optionName, price: optionPrice }],
                },
                ...prev.slice(existingGroupIndex + 1),
              ];
            }
            return prev; // Max reached
          }
        } else {
          // New group selection
          return [
            ...prev,
            {
              groupId,
              groupName,
              options: [{ id: optionId, name: optionName, price: optionPrice }],
            },
          ];
        }
      } else {
        // Remove selection
        if (existingGroupIndex >= 0) {
          const existing = prev[existingGroupIndex];
          const newOptions = existing.options.filter(opt => opt.id !== optionId);
          
          if (newOptions.length === 0) {
            // Remove entire group if no options left
            return [...prev.slice(0, existingGroupIndex), ...prev.slice(existingGroupIndex + 1)];
          } else {
            // Update group with remaining options
            return [
              ...prev.slice(0, existingGroupIndex),
              { ...existing, options: newOptions },
              ...prev.slice(existingGroupIndex + 1),
            ];
          }
        }
        return prev;
      }
    });
    
    // Clear error for this group when user makes a selection
    if (errors[groupId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[groupId];
        return newErrors;
      });
    }
  };

  const calculateModifierPrice = (): number => {
    return selectedModifiers.reduce((total, modifier) => {
      return total + modifier.options.reduce((sum, opt) => sum + opt.price, 0);
    }, 0);
  };

  const calculateTotalPrice = (): number => {
    return (item.price + calculateModifierPrice()) * quantity;
  };

  const validateSelections = (): boolean => {
    if (!item.modifier_groups) return true;
    
    const newErrors: Record<string, string> = {};
    
    item.modifier_groups.forEach(group => {
      const selectedGroup = selectedModifiers.find(m => m.groupId === group.id);
      const selectedCount = selectedGroup?.options.length || 0;
      
      if (group.required && selectedCount < group.minSelections) {
        newErrors[group.id] = group.minSelections === 1 
          ? "Please select an option" 
          : `Please select at least ${group.minSelections} options`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddToCart = () => {
    if (!validateSelections()) {
      return;
    }
    
    onAddToCart(item, quantity, selectedModifiers, calculateModifierPrice(), specialInstructions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Image */}
        <div className="relative">
          {item.image_url ? (
            <img 
              src={item.image_url} 
              alt={item.name}
              className="w-full h-56 sm:h-64 object-cover"
            />
          ) : (
            <div className="w-full h-56 sm:h-64 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900" />
          )}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white dark:bg-gray-800 rounded-full shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Item Details */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{item.name}</h2>
            {item.description && (
              <p className="text-gray-600 dark:text-gray-300 text-sm">{item.description}</p>
            )}
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-3">
              £{item.price.toFixed(2)}
            </p>
          </div>

          {/* Modifier Groups */}
          {item.modifier_groups && item.modifier_groups.length > 0 && (
            <div className="space-y-6">
              {item.modifier_groups.map(group => (
                <ModifierGroupComponent
                  key={group.id}
                  group={group}
                  selectedModifiers={selectedModifiers}
                  onModifierChange={handleModifierChange}
                  error={errors[group.id]}
                />
              ))}
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Special Instructions
            </label>
            <Textarea
              placeholder="Any special requests? (e.g., 'No onions', 'Extra crispy')"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="min-h-[80px] text-base"
              maxLength={200}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {specialInstructions.length}/200 characters
            </p>
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center justify-between py-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Quantity</span>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0"
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xl font-bold text-gray-900 dark:text-white min-w-[2rem] text-center">
                {quantity}
              </span>
              <Button
                onClick={() => setQuantity(quantity + 1)}
                size="sm"
                variant="outline"
                className="h-10 w-10 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={handleAddToCart}
            className="w-full h-14 text-lg font-semibold bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Check className="h-5 w-5 mr-2" />
            Add to Cart · £{calculateTotalPrice().toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
}

