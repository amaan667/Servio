"use client";

import { Check } from "lucide-react";
import { ModifierGroup, SelectedModifier } from "../types";

interface ModifierGroupComponentProps {
  group: ModifierGroup;
  selectedModifiers: SelectedModifier[];
  onModifierChange: (
    groupId: string,
    groupName: string,
    optionId: string,
    optionName: string,
    optionPrice: number,
    isSelected: boolean,
    group: ModifierGroup
  ) => void;
  error?: string;
}

export function ModifierGroupComponent({
  group,
  selectedModifiers,
  onModifierChange,
  error,
}: ModifierGroupComponentProps) {
  const selectedGroup = selectedModifiers.find(m => m.groupId === group.id);
  const selectedOptionIds = new Set(selectedGroup?.options.map(opt => opt.id) || []);
  const isSingleSelect = group.maxSelections === 1;

  const getSelectionText = () => {
    if (group.required) {
      if (group.minSelections === 1 && group.maxSelections === 1) {
        return "Required";
      } else if (group.minSelections === group.maxSelections) {
        return `Choose ${group.minSelections}`;
      } else {
        return `Choose ${group.minSelections}-${group.maxSelections}`;
      }
    } else {
      if (group.maxSelections === 1) {
        return "Optional";
      } else if (group.maxSelections === 999) {
        return "Optional (Multiple)";
      } else {
        return `Optional (Up to ${group.maxSelections})`;
      }
    }
  };

  const isOptionDisabled = (optionId: string): boolean => {
    if (selectedOptionIds.has(optionId)) return false;
    if (!isSingleSelect && selectedGroup && selectedGroup.options.length >= group.maxSelections) {
      return true;
    }
    return false;
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      {/* Group Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {group.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {getSelectionText()}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Options */}
      <div className="space-y-2">
        {group.options.map(option => {
          const isSelected = selectedOptionIds.has(option.id);
          const isDisabled = isOptionDisabled(option.id);

          return (
            <button
              key={option.id}
              onClick={() => {
                if (!isDisabled) {
                  onModifierChange(
                    group.id,
                    group.name,
                    option.id,
                    option.name,
                    option.price,
                    !isSelected,
                    group
                  );
                }
              }}
              disabled={isDisabled}
              className={`
                w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all
                ${isSelected
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                  : isDisabled
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-50 cursor-not-allowed'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-gray-800'
                }
              `}
            >
              <div className="flex items-center space-x-3 flex-1">
                {/* Selection Indicator */}
                <div className={`
                  flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                  ${isSingleSelect ? '' : 'rounded-md'}
                  ${isSelected
                    ? 'border-purple-600 bg-purple-600'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                  }
                `}>
                  {isSelected && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </div>

                {/* Option Name */}
                <span className={`
                  text-left font-medium
                  ${isSelected
                    ? 'text-gray-900 dark:text-white'
                    : isDisabled
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}>
                  {option.name}
                </span>
              </div>

              {/* Price */}
              {option.price !== 0 && (
                <span className={`
                  text-sm font-semibold
                  ${isSelected
                    ? 'text-purple-600 dark:text-purple-400'
                    : isDisabled
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-600 dark:text-gray-400'
                  }
                `}>
                  {option.price > 0 ? '+' : ''}£{option.price.toFixed(2)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

