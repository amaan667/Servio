# Translation Testing Guide

## Overview

This document describes the translation testing system for the Servio AI Assistant. The translation feature supports 9 languages and includes comprehensive accuracy testing.

## Supported Languages

- **English** (en) - Base language
- **Spanish** (es)
- **Arabic** (ar)
- **French** (fr)
- **German** (de)
- **Italian** (it)
- **Portuguese** (pt)
- **Chinese** (zh)
- **Japanese** (ja)

## Features Tested

### 1. Translation Accuracy
- Round-trip translations (EN → X → EN) maintain content accuracy
- Category mappings are correctly applied
- Item names and descriptions are properly translated
- At least 80% of items show translated content

### 2. Data Integrity
- **No Duplicates**: Translation never creates duplicate menu items
- **Item Count**: Total number of items remains constant
- **Item IDs**: All original item IDs are preserved
- **No Omissions**: All items are included in translation

### 3. Category Preservation
- Number of categories remains constant
- No new categories are created during translation
- Category mappings are accurate and consistent

### 4. Automatic Page Refresh
- After translation execution, the page automatically refreshes after 3 seconds
- User is navigated to see the changes immediately
- Works for all AI actions: translation, QR generation, add/delete items

## Running Tests

### Automated Test Suite

Run the full Jest test suite:

```bash
npm test tests/translation-accuracy.test.ts
```

Or with specific language:

```bash
npm test tests/translation-accuracy.test.ts -- --testNamePattern="Spanish"
```

### Manual Test Script

For manual testing with a real venue:

```bash
# Basic usage
tsx scripts/test-translation-accuracy.ts venue-your-venue-id

# With environment variables
NEXT_PUBLIC_SITE_URL=https://your-site.com tsx scripts/test-translation-accuracy.ts venue-abc123
```

The script will:
1. Test round-trip translations for all 8 non-English languages
2. Verify no duplicates are created
3. Check category preservation
4. Validate translation rates
5. Provide a detailed summary report

### Expected Output

```
═══════════════════════════════════════════════════════
  🌍 Translation Accuracy Test Suite
═══════════════════════════════════════════════════════
Venue ID: venue-abc123
Testing 8 language pairs

📊 Initial menu state:
   Items: 45
   Categories: 6

🧪 Testing round-trip: English → Spanish → English
  📊 Initial state: 45 items, 6 categories
  → Translating to es...
  ✓ After es: 45 items, 6 categories
  ✓ After English: 45 items, 6 categories
  📝 Translation rate: 95.6% (43/45 items)
  ✅ Round-trip test PASSED for es

[... tests for other languages ...]

═══════════════════════════════════════════════════════
  📊 Test Summary
═══════════════════════════════════════════════════════

✅ Passed: 8/8
❌ Failed: 0/8

═══════════════════════════════════════════════════════
✅ All tests passed! Translations are working correctly.
```

## Category Mappings

### English → Spanish
- STARTERS → ENTRADAS
- MAIN COURSES → PLATOS PRINCIPALES
- DESSERTS → POSTRES
- DRINKS → BEBIDAS
- COFFEE → CAFÉ
- [... and more]

### English → Arabic
- STARTERS → المقبلات
- MAIN COURSES → الأطباق الرئيسية
- DESSERTS → الحلويات
- DRINKS → المشروبات
- COFFEE → القهوة
- [... and more]

Full mappings available in: `lib/ai/executors/translation-executor.ts`

## Translation Executor Logic

### Source Language Detection

The system automatically detects the source language by analyzing:
1. Common category indicators (e.g., "CAFÉ", "BEBIDAS" for Spanish)
2. Common words and phrases in item names
3. Character sets (e.g., Arabic script)

If detection is uncertain, it defaults to English.

### Translation Process

1. **Batch Processing**: Items are translated in batches of 15 for efficiency
2. **Retry Logic**: Up to 3 retries for failed batches
3. **Validation**: Ensures exact item count is maintained
4. **Database Updates**: Only updates existing items, never creates new ones
5. **Cache Revalidation**: Clears cache to show updated translations immediately

### Error Handling

- **Item Count Mismatch**: Fails if translation returns different number of items
- **Missing Items**: Validates all item IDs are present
- **API Failures**: Retries with exponential backoff
- **Fallback**: Returns original items if all retries fail

## Known Limitations

1. **Proper Nouns**: Some brand names or proper nouns may be translated when they should remain unchanged
2. **Context**: Translation is item-by-item; may lack broader menu context
3. **Idioms**: Idiomatic expressions may lose nuance in translation
4. **Formatting**: Special formatting (e.g., all-caps) may not be preserved

## Troubleshooting

### Issue: Translations appear incorrect

**Solution**: 
- Check the category mappings in `translation-executor.ts`
- Verify the source language detection is correct
- Review the prompt used for GPT-4o translation

### Issue: Duplicates created

**Solution**:
- This should never happen; check the executor code
- Verify database constraints are in place
- Run the test suite to identify the root cause

### Issue: Some items not translated

**Solution**:
- Check batch size and retry logic
- Verify OpenAI API is responding correctly
- Check logs for specific item failures

### Issue: Categories not translating

**Solution**:
- Verify category exists in CATEGORY_MAPPINGS
- Check source language detection
- Add missing category to mappings if needed

## Adding New Languages

To add support for a new language:

1. Add language code to `LANGUAGE_NAMES` in `translation-executor.ts`
2. Create bidirectional category mappings (en-XX and XX-en)
3. Add language indicators for source detection
4. Test round-trip translation thoroughly
5. Update this documentation

Example:

```typescript
// In LANGUAGE_NAMES
hi: "Hindi",

// In CATEGORY_MAPPINGS
"en-hi": {
  STARTERS: "स्टार्टर्स",
  "MAIN COURSES": "मुख्य व्यंजन",
  // ... more mappings
},
"hi-en": {
  "स्टार्टर्स": "STARTERS",
  "मुख्य व्यंजन": "MAIN COURSES",
  // ... more mappings
},
```

## Best Practices

1. **Test Thoroughly**: Always run the full test suite after changes
2. **Review Translations**: Manually review translations for quality
3. **Update Mappings**: Keep category mappings comprehensive
4. **Monitor Logs**: Check logs for translation failures or warnings
5. **User Feedback**: Collect feedback on translation quality

## API Usage

The translation feature uses OpenAI GPT-4o with:
- **Model**: `gpt-4o-2024-08-06`
- **Temperature**: `0.1` (for consistency)
- **Response Format**: JSON
- **Batch Size**: 15 items per request
- **Retries**: Up to 3 attempts per batch

## Performance

Typical translation times:
- **Small menu** (< 20 items): 5-10 seconds
- **Medium menu** (20-50 items): 15-30 seconds
- **Large menu** (> 50 items): 30-60 seconds

Times may vary based on:
- OpenAI API response time
- Number of items
- Whether descriptions are included
- Network latency

## Monitoring

Check logs for translation status:

```bash
# View translation logs
grep "\[AI ASSISTANT\].*Translation" logs/app.log

# Check for errors
grep "Translation.*error" logs/app.log

# View translation counts
grep "translated.*items" logs/app.log
```

## Security

- Translations use venue-scoped queries (RLS enforced)
- Only authenticated users can trigger translations
- API keys are server-side only
- No sensitive data is sent to OpenAI beyond menu content

## Conclusion

The translation system is designed to be robust, accurate, and user-friendly. Regular testing ensures quality remains high across all supported languages. Report any issues or suggestions to the development team.

