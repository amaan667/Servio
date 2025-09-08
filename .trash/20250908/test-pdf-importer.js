#!/usr/bin/env node

/**
 * Test script for the new PDF importer
 * Demonstrates the comprehensive PDF→Menu import system
 */

const fs = require('fs');
const path = require('path');

// Mock data for testing
const mockPDFBuffer = Buffer.from('Mock PDF content');
const mockVenueId = 'test-venue-123';

// Mock Supabase client
const mockSupabaseClient = {
  rpc: async (functionName, params) => {
    console.log(`[MOCK] RPC call: ${functionName}`, params);
    
    if (functionName === 'api_replace_catalog') {
      return {
        data: {
          success: true,
          venue_id: params.p_venue_id,
          categories_created: 3,
          items_created: 15,
          options_created: 2,
          aliases_created: 0,
          images_created: 0,
          timestamp: new Date().toISOString()
        },
        error: null
      };
    }
    
    if (functionName === 'validate_catalog_payload') {
      return {
        data: {
          valid: true,
          errors: [],
          warnings: [],
          items_count: 15,
          zero_price_count: 0,
          missing_price_count: 0
        },
        error: null
      };
    }
    
    return { data: null, error: null };
  },
  
  storage: {
    from: () => ({
      upload: async () => ({ error: null })
    })
  },
  
  from: () => ({
    insert: async () => ({ error: null })
  })
};

async function testPDFImporter() {
  console.log('🧪 Testing PDF Importer System');
  console.log('================================');
  
  try {
    // Import the main importer function
    const { importPDFToMenu, generateImportReport, validateImportResult } = await import('./lib/pdfImporter/mainImporter.js');
    
    console.log('\n📄 Testing with mock PDF data...');
    
    // Test the import process
    const result = await importPDFToMenu(
      mockPDFBuffer,
      mockVenueId,
      mockSupabaseClient,
      {
        mode: 'auto',
        enableGPT: false, // Disable GPT for testing
        enableValidation: true
      }
    );
    
    console.log('\n📊 Import Results:');
    console.log('==================');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    
    if (result.success) {
      console.log(`Processing time: ${result.metadata?.processingTime || 0}ms`);
      console.log(`Source type: ${result.metadata?.sourceType?.type || 'unknown'}`);
      console.log(`Items processed: ${result.metadata?.itemsProcessed || 0}`);
      console.log(`Prices found: ${result.metadata?.pricesFound || 0}`);
      console.log(`Coverage rate: ${result.metadata?.coverageRate?.toFixed(1) || 0}%`);
      
      if (result.catalog) {
        console.log(`Categories: ${result.catalog.categories.length}`);
        console.log(`Total items: ${result.catalog.categories.reduce((sum, cat) => sum + cat.items.length, 0)}`);
        console.log(`Option groups: ${result.catalog.metadata.optionGroups}`);
      }
      
      if (result.coverage) {
        console.log(`\n📈 Coverage Report:`);
        console.log(`Prices found: ${result.coverage.pricesFound}`);
        console.log(`Prices attached: ${result.coverage.pricesAttached}`);
        console.log(`Unattached prices: ${result.coverage.unattachedPrices.length}`);
        console.log(`Empty sections: ${result.coverage.sectionsWithZeroItems.length}`);
      }
      
      if (result.validation) {
        console.log(`\n✅ Validation:`);
        console.log(`Valid: ${result.validation.valid ? 'YES' : 'NO'}`);
        console.log(`Errors: ${result.validation.errors.length}`);
        console.log(`Warnings: ${result.validation.warnings.length}`);
      }
      
      if (result.quality) {
        console.log(`\n🎯 Quality Assessment:`);
        console.log(`High quality: ${result.quality.isHighQuality ? 'YES' : 'NO'}`);
        if (result.quality.issues.length > 0) {
          console.log(`Issues: ${result.quality.issues.join(', ')}`);
        }
        if (result.quality.recommendations.length > 0) {
          console.log(`Recommendations: ${result.quality.recommendations.join(', ')}`);
        }
      }
      
      if (result.warnings && result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings:`);
        result.warnings.forEach(warning => console.log(`  • ${warning}`));
      }
      
      // Generate comprehensive report
      console.log(`\n📋 Comprehensive Report:`);
      console.log('========================');
      const report = generateImportReport(result);
      console.log(report);
      
      // Validate import result
      const qualityCheck = validateImportResult(result);
      console.log(`\n🔍 Quality Check:`);
      console.log(`High quality: ${qualityCheck.isHighQuality ? '✅' : '❌'}`);
      if (qualityCheck.issues.length > 0) {
        console.log(`Issues: ${qualityCheck.issues.join(', ')}`);
      }
      if (qualityCheck.recommendations.length > 0) {
        console.log(`Recommendations: ${qualityCheck.recommendations.join(', ')}`);
      }
      
    } else {
      console.log(`Error: ${result.error}`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPDFImporter();
}

module.exports = { testPDFImporter };
