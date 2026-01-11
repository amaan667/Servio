// Servio AI Assistant - Extended Menu Tool Executors

import { AIExecutionResult, AIPreviewDiff } from "@/types/ai-assistant";
import {
  getMenuItemsWithoutImages,
  updateMenuItemImage,
  translateMenuItems,
} from "../tools/extended-menu-tools";

/**
 * Execute query for menu items without images
 */
export async function executeMenuQueryNoImages(
  _params: Record<string, never>,
  venueId: string,
  _userId: string,
  _preview: boolean
): Promise<AIExecutionResult> {
  const result = await getMenuItemsWithoutImages(venueId);

  return {
    success: true,
    toolName: "menu.query_no_images",
    result: {
      items: result.items,
      count: result.count,
      summary: result.summary,
    },
    auditId: "",
  };
}

/**
 * Execute image upload for menu item
 */
export async function executeMenuUploadImage(
  params: { itemName: string; imageUrl: string },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "menu.upload_image",
      before: [{ itemName: params.itemName, imageUrl: null }],
      after: [{ itemName: params.itemName, imageUrl: params.imageUrl }],
      impact: {
        itemsAffected: 1,
        description: `Will add image to "${params.itemName}"`,
      },
    };
  }

  const result = await updateMenuItemImage(venueId, params.itemName, params.imageUrl);

  return {
    success: true,
    toolName: "menu.upload_image",
    result: {
      itemId: result.itemId,
      itemName: result.itemName,
      imageUrl: result.imageUrl,
      message: result.message,
    },
    auditId: "",
  };
}

/**
 * Execute menu translation
 */
export async function executeMenuTranslateExtended(
  params: { targetLanguage: string; categories?: string[] },
  venueId: string,
  _userId: string,
  preview: boolean
): Promise<AIPreviewDiff | AIExecutionResult> {
  if (preview) {
    return {
      toolName: "menu.translate_extended",
      before: [],
      after: [],
      impact: {
        itemsAffected: 0,
        description: `Will translate menu to ${params.targetLanguage}${params.categories ? ` (categories: ${params.categories.join(", ")})` : ""}`,
      },
    };
  }

  const result = await translateMenuItems(venueId, params.targetLanguage, params.categories);

  return {
    success: result.success,
    toolName: "menu.translate_extended",
    result: {
      itemsTranslated: result.itemsTranslated,
      targetLanguage: result.targetLanguage,
      jobId: result.jobId,
      message: result.message,
    },
    auditId: "",
  };
}
