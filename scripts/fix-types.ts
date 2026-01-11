#!/usr/bin/env tsx
/**
 * Script to fix common type errors from incomplete logger removals
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

const files = glob.sync("**/*.{ts,tsx}", {
  ignore: ["node_modules/**", ".next/**", "dist/**", "build/**", "__tests__/**", "scripts/**"],
});

let fixed = 0;

for (const file of files) {
  let content = readFileSync(file, "utf-8");
  let modified = false;

  // Fix empty interfaces that should have properties
  if (content.includes('interface MenuItem {\n\n}')) {
    content = content.replace(
      /interface MenuItem \{\s*\n\s*\n\}/g,
      `interface MenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  image_url?: string;
  allergens?: string[];
  dietary?: string[];
  spiceLevel?: string | null;
  page_index?: number;
  source?: string;
  has_web_enhancement?: boolean;
  has_image?: boolean;
  merge_source?: string;
  name_normalized?: string;
  _matchReason?: string;
  _matchConfidence?: number;
  _matchScore?: number;
  _unmatched?: boolean;
}`
    );
    modified = true;
  }

  // Fix HybridExtractionOptions
  if (content.includes('interface HybridExtractionOptions') && content.includes('venueId')) {
    content = content.replace(
      /interface HybridExtractionOptions \{[^}]*venueId[^}]*\n\s*\}/gs,
      `interface HybridExtractionOptions {
  pdfImages?: string[];
  websiteUrl?: string;
  venueId: string;
}`
    );
    modified = true;
  }

  // Fix HybridMenuResult
  if (content.includes('interface HybridMenuResult') && content.includes('items:')) {
    content = content.replace(
      /interface HybridMenuResult \{\s*\n\s*\n\}/g,
      `interface HybridMenuResult {
  items: MenuItem[];
  itemCount: number;
  hasWebData: boolean;
  hasPdfData: boolean;
  mode: "url-only" | "pdf-only" | "hybrid";
}`
    );
    modified = true;
  }

  // Fix extractMenuHybrid function signature
  if (content.includes('export async function extractMenuHybrid(') && !content.includes('options: HybridExtractionOptions')) {
    content = content.replace(
      /export async function extractMenuHybrid\(\s*\n\s*\)/g,
      `export async function extractMenuHybrid(
  options: HybridExtractionOptions
)`
    );
    modified = true;
  }

  // Fix MatchCorrection interface
  if (content.includes('interface MatchCorrection') && content.includes('wasMatched')) {
    content = content.replace(
      /interface MatchCorrection \{\s*\n\s*\n\s*metadata\?/g,
      `interface MatchCorrection {
  venueId: string;
  pdfItemName: string;
  urlItemName: string;
  similarityScore: number;
  wasMatched: boolean;
  shouldMatch: boolean;
  correctedBy: string;
  metadata?`
    );
    modified = true;
  }

  // Fix CategoryCorrection interface
  if (content.includes('interface CategoryCorrection') && content.includes('aiSuggestedCategory')) {
    content = content.replace(
      /interface CategoryCorrection \{\s*\n\s*\n\s*metadata\?/g,
      `interface CategoryCorrection {
  venueId: string;
  itemName: string;
  aiSuggestedCategory: string;
  userAssignedCategory: string;
  confidenceScore: number;
  correctedBy: string;
  metadata?`
    );
    modified = true;
  }

  // Fix CircuitBreakerState
  if (content.includes('interface CircuitBreakerState') && content.includes('state:')) {
    content = content.replace(
      /interface CircuitBreakerState \{\s*\n\s*\n\}/g,
      `interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}`
    );
    modified = true;
  }

  // Fix DEFAULT_RETRY_OPTIONS
  if (content.includes('const DEFAULT_RETRY_OPTIONS') && !content.includes('maxRetries:')) {
    content = content.replace(
      /const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = \{\s*\n\s*\n\s*initialDelay:/g,
      `const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay:`
    );
    content = content.replace(
      /maxDelay: 10000,\s*\n\s*\n\s*retryableErrors:/g,
      `maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors:`
    );
    modified = true;
  }

  // Fix return statements in extractMenuHybrid
  if (content.includes('return {') && content.includes('webItems,') && !content.includes('items:')) {
    content = content.replace(
      /return \{\s*\n\s*\n\s*\};/g,
      `return {
      items: webItems,
      itemCount: webItems.length,
      hasWebData: true,
      hasPdfData: false,
      mode: "url-only",
    };`
    );
    modified = true;
  }

  if (content.includes('return {') && content.includes('pdfData.items,') && !content.includes('items:')) {
    content = content.replace(
      /return \{\s*\n\s*\n\s*\};/g,
      `return {
      items: pdfData.items,
      itemCount: pdfData.items.length,
      hasWebData: false,
      hasPdfData: true,
      mode: "pdf-only",
    };`
    );
    modified = true;
  }

  if (content.includes('return {') && content.includes('mergedItems,') && !content.includes('items:')) {
    content = content.replace(
      /return \{\s*\n\s*\n\s*\};/g,
      `return {
      items: mergedItems,
      itemCount: mergedItems.length,
      hasWebData: true,
      hasPdfData: true,
      mode: "hybrid",
    };`
    );
    modified = true;
  }

  // Fix recordMatchCorrection
  if (content.includes('const correctionType =') && content.includes('correction.wasMatched') && !content.includes('correction.shouldMatch')) {
    content = content.replace(
      /const correctionType =\s*\n\s*correction\.wasMatched === correction\.shouldMatch\s*\n\s*\? "correct"\s*\n\s*:/g,
      `const correctionType =
      correction.wasMatched === correction.shouldMatch
        ? "correct"
        : correction.shouldMatch
          ? "false_negative"
          : "false_positive";`
    );
    modified = true;
  }

  if (content.includes('await supabase.from("match_corrections").insert({') && !content.includes('venue_id:')) {
    content = content.replace(
      /await supabase\.from\("match_corrections"\)\.insert\(\{\s*\n\s*\n\s*metadata:/g,
      `await supabase.from("match_corrections").insert({
      venue_id: correction.venueId,
      pdf_item_name: correction.pdfItemName,
      url_item_name: correction.urlItemName,
      similarity_score: correction.similarityScore,
      was_matched: correction.wasMatched,
      should_match: correction.shouldMatch,
      correction_type: correctionType,
      corrected_by: correction.correctedBy,
      metadata:`
    );
    modified = true;
  }

  // Fix recordCategoryCorrection
  if (content.includes('await supabase.from("category_corrections").insert({') && !content.includes('venue_id:')) {
    content = content.replace(
      /await supabase\.from\("category_corrections"\)\.insert\(\{\s*\n\s*\n\s*metadata:/g,
      `await supabase.from("category_corrections").insert({
      venue_id: correction.venueId,
      item_name: correction.itemName,
      ai_suggested_category: correction.aiSuggestedCategory,
      user_assigned_category: correction.userAssignedCategory,
      confidence_score: correction.confidenceScore,
      was_correct: wasCorrect,
      corrected_by: correction.correctedBy,
      metadata:`
    );
    modified = true;
  }

  // Fix getAdaptiveMatchingThreshold
  if (content.includes('export async function getAdaptiveMatchingThreshold(') && !content.includes('venueId: string')) {
    content = content.replace(
      /export async function getAdaptiveMatchingThreshold\(\s*\n\s*\n\s*defaultThreshold:/g,
      `export async function getAdaptiveMatchingThreshold(
  venueId: string,
  defaultThreshold:`
    );
    modified = true;
  }

  // Fix recordAIPerformanceMetric
  if (content.includes('export async function recordAIPerformanceMetric(') && !content.includes('metricType:')) {
    content = content.replace(
      /export async function recordAIPerformanceMetric\(\s*\n\s*\n\s*metadata\?/g,
      `export async function recordAIPerformanceMetric(
  metricType: "matching" | "categorization" | "extraction",
  success: boolean,
  confidence: number,
  processingTimeMs: number,
  metadata?`
    );
    modified = true;
  }

  // Fix withStripeRetry
  if (content.includes('export async function withStripeRetry<T>(') && !content.includes('fn: () => Promise<T>')) {
    content = content.replace(
      /export async function withStripeRetry<T>\(\s*\n\s*\n\s*options:/g,
      `export async function withStripeRetry<T>(
  fn: () => Promise<T>,
  options:`
    );
    modified = true;
  }

  // Fix getCircuitBreakerState return type
  if (content.includes('export function getCircuitBreakerState():') && !content.includes('state:')) {
    content = content.replace(
      /export function getCircuitBreakerState\(\): \{\s*\n\s*\n\s*\}/g,
      `export function getCircuitBreakerState(): {
  state: "closed" | "open" | "half-open";
}`
    );
    content = content.replace(
      /return \{\s*\n\s*state: circuitBreaker\.getState\(\),\s*\n\s*\}/g,
      `return {
    state: circuitBreaker.getState(),
  };`
    );
    modified = true;
  }

  if (modified) {
    writeFileSync(file, content, "utf-8");
    fixed++;

  }
}
