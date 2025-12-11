"use client";

import React, { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatPriceWithCurrency } from "@/lib/pricing-utils";

export interface ModifierOption {
  id?: string;
  name: string;
  price_modifier: number;
  is_available: boolean;
  display_order?: number;
}

export interface MenuItemModifier {
  id?: string;
  menu_item_id: string;
  name: string;
  type: "single" | "multiple";
  required: boolean;
  options: ModifierOption[];
  display_order?: number;
}

export interface SelectedModifiers {
  [modifierName: string]: string[]; // For single: [selectedOption], For multiple: [option1, option2, ...]
}

interface ModifierSelectorProps {
  modifiers: MenuItemModifier[];
  onModifiersChange: (selectedModifiers: SelectedModifiers, priceModifier: number) => void;
  initialSelected?: SelectedModifiers;
}

export function ModifierSelector({
  modifiers,
  onModifiersChange,
  initialSelected = {},
}: ModifierSelectorProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifiers>(initialSelected);

  useEffect(() => {
    // Calculate total price modifier
    let totalModifier = 0;
    Object.values(selectedModifiers).forEach((optionNames) => {
      optionNames.forEach((optionName) => {
        modifiers.forEach((modifier) => {
          const option = modifier.options.find((opt) => opt.name === optionName);
          if (option) {
            totalModifier += option.price_modifier;
          }
        });
      });
    });

    onModifiersChange(selectedModifiers, totalModifier);
  }, [selectedModifiers, modifiers, onModifiersChange]);

  const handleSingleSelect = (modifierName: string, optionName: string) => {
    setSelectedModifiers((prev) => ({
      ...prev,
      [modifierName]: [optionName],
    }));
  };

  const handleMultipleSelect = (modifierName: string, optionName: string, checked: boolean) => {
    setSelectedModifiers((prev) => {
      const current = prev[modifierName] || [];
      if (checked) {
        return {
          ...prev,
          [modifierName]: [...current, optionName],
        };
      } else {
        return {
          ...prev,
          [modifierName]: current.filter((name) => name !== optionName),
        };
      }
    });
  };

  // Sort modifiers by display_order
  const sortedModifiers = [...modifiers].sort(
    (a, b) => (a.display_order || 0) - (b.display_order || 0)
  );

  if (modifiers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-sm font-semibold text-foreground">Customize Your Order</h3>
      {sortedModifiers.map((modifier) => {
        const selectedOptions = selectedModifiers[modifier.name] || [];
        const sortedOptions = [...modifier.options]
          .filter((opt) => opt.is_available)
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        return (
          <div key={modifier.name} className="space-y-2">
            <Label className="text-sm font-medium">
              {modifier.name}
              {modifier.required && <span className="text-red-500 ml-1">*</span>}
            </Label>

            {modifier.type === "single" ? (
              <RadioGroup
                value={selectedOptions[0] || ""}
                onValueChange={(value) => handleSingleSelect(modifier.name, value)}
                required={modifier.required}
              >
                {sortedOptions.map((option) => (
                  <div key={option.name} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.name} id={`${modifier.name}-${option.name}`} />
                    <Label
                      htmlFor={`${modifier.name}-${option.name}`}
                      className="flex-1 flex items-center justify-between cursor-pointer"
                    >
                      <span>{option.name}</span>
                      {option.price_modifier !== 0 && (
                        <span className="text-sm font-medium text-muted-foreground">
                          {option.price_modifier > 0 ? "+" : ""}
                          {formatPriceWithCurrency(option.price_modifier, "£")}
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {sortedOptions.map((option) => {
                  const isChecked = selectedOptions.includes(option.name);
                  return (
                    <div key={option.name} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${modifier.name}-${option.name}`}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          handleMultipleSelect(modifier.name, option.name, checked === true)
                        }
                      />
                      <Label
                        htmlFor={`${modifier.name}-${option.name}`}
                        className="flex-1 flex items-center justify-between cursor-pointer"
                      >
                        <span>{option.name}</span>
                        {option.price_modifier !== 0 && (
                          <span className="text-sm font-medium text-muted-foreground">
                            {option.price_modifier > 0 ? "+" : ""}
                            {formatPriceWithCurrency(option.price_modifier, "£")}
                          </span>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
