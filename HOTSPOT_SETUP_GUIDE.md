# Hotspot System Setup Guide

## Quick Start (5 Minutes)

### Step 1: Run Database Migration

```bash
# Connect to your database
psql -d your_database_name

# Run the migration
\i migrations/menu-hotspots-schema.sql

# Verify table was created
\dt menu_hotspots
```

### Step 2: Verify Environment Variables

Ensure these are set in your `.env` file:

```bash
# OpenAI API Key (required for hotspot detection)
OPENAI_API_KEY=sk-...

# Next.js App URL (for API calls)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Step 3: Test the System

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Navigate to Menu Management**:
   - Go to `/dashboard/[venueId]/menu-management`
   - Select the **Manage** tab

3. **Upload a PDF Menu** (if not already done):
   - Click "Upload Menu" in the Upload Menu section
   - Select a PDF file
   - Wait for processing to complete

4. **Enable Hotspots**:
   - Scroll to "Interactive Hotspots" section
   - Click "Enable Interactive Hotspots" button
   - Wait for detection (30-60 seconds)
   - You should see: "✅ Hotspots detected successfully!"

5. **Test in Preview**:
   - Go to **Preview** tab
   - Click on any menu item hotspot
   - Item details modal should appear
   - Try adding items to cart

### Step 4: Verify Everything Works

✅ **Checklist**:
- [ ] Database migration completed successfully
- [ ] Environment variables configured
- [ ] PDF menu uploaded
- [ ] Hotspots detected (check green status indicator)
- [ ] Can click hotspots in preview
- [ ] Item modal opens correctly
- [ ] Can switch between PDF and List views
- [ ] Search works in List view
- [ ] Mobile pinch-zoom works (test on phone)

## Common Issues & Solutions

### Issue 1: "No PDF menu found"

**Solution**: Upload a PDF menu first in the Manage tab

### Issue 2: "Failed to detect hotspots"

**Possible Causes**:
- OpenAI API key not configured
- PDF has no text (only images)
- Menu items not extracted properly

**Solutions**:
```bash
# Check OpenAI key
echo $OPENAI_API_KEY

# Check menu items exist
# In Supabase dashboard:
SELECT COUNT(*) FROM menu_items WHERE venue_id = 'your_venue_id';
```

### Issue 3: Hotspots not clickable

**Solution**: 
- Ensure you're in Preview tab with PDF view mode
- Check browser console for errors
- Clear browser cache

### Issue 4: Database errors

**Solution**:
```bash
# Re-run migration
psql -d your_database -f migrations/menu-hotspots-schema.sql

# Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'menu_hotspots';
```

## Production Deployment

### Railway Deployment

1. **Set Environment Variables**:
   ```bash
   railway variables set OPENAI_API_KEY=sk-...
   railway variables set NEXT_PUBLIC_APP_URL=https://your-app.railway.app
   ```

2. **Run Migration**:
   ```bash
   # Connect to Railway database
   railway connect

   # Run migration
   \i migrations/menu-hotspots-schema.sql
   ```

3. **Deploy**:
   ```bash
   railway up
   ```

### Vercel Deployment

1. **Set Environment Variables** in Vercel Dashboard
2. **Run Migration** using Vercel CLI:
   ```bash
   vercel env pull
   # Edit .env file
   psql $DATABASE_URL -f migrations/menu-hotspots-schema.sql
   ```
3. **Deploy**:
   ```bash
   vercel --prod
   ```

## Testing Checklist

### Desktop Testing

- [ ] Upload PDF menu
- [ ] Enable hotspots
- [ ] Click hotspots in PDF view
- [ ] View item details modal
- [ ] Add items to cart
- [ ] Switch to list view
- [ ] Search functionality
- [ ] Zoom controls work

### Mobile Testing

- [ ] Pinch to zoom works
- [ ] Drag to pan works
- [ ] Sticky cart appears
- [ ] Touch targets are large enough
- [ ] Modal is responsive
- [ ] List view is scrollable

### Edge Cases

- [ ] PDF with single page
- [ ] PDF with multiple pages
- [ ] PDF with no text (images only)
- [ ] Empty menu
- [ ] Very long menu (100+ items)
- [ ] Special characters in item names

## Performance Benchmarks

### Expected Performance

- **Hotspot Detection**: 30-60 seconds for typical menu
- **PDF Rendering**: < 1 second per page
- **Hotspot Click Response**: < 100ms
- **Modal Open**: < 200ms
- **View Switch**: < 300ms

### Optimization Tips

1. **Reduce PDF Size**: Compress images before upload
2. **Limit Hotspots**: Keep < 50 per page
3. **Use WEBP**: Enable image conversion
4. **Enable Caching**: Use CDN for PDF images
5. **Lazy Load**: Enable lazy loading for images

## Monitoring

### Check Hotspot Status

```sql
-- Count hotspots per venue
SELECT venue_id, COUNT(*) as hotspot_count
FROM menu_hotspots
WHERE is_active = true
GROUP BY venue_id;

-- Check detection confidence
SELECT 
  AVG(confidence) as avg_confidence,
  MIN(confidence) as min_confidence,
  MAX(confidence) as max_confidence
FROM menu_hotspots
WHERE is_active = true;
```

### Monitor API Usage

```bash
# Check OpenAI API usage
# Visit: https://platform.openai.com/usage

# Check API endpoint logs
# In Railway/Vercel dashboard
```

## Support

### Getting Help

1. **Documentation**: Read `HOTSPOT_SYSTEM.md`
2. **Console Logs**: Check browser console for errors
3. **Database**: Verify data in Supabase dashboard
4. **API Logs**: Check server logs in deployment platform

### Debug Mode

Enable debug logging:

```typescript
// In components
const DEBUG = true;
if (DEBUG) console.log('[HOTSPOT]', data);

// In API routes
console.log('[HOTSPOT DETECT]', JSON.stringify(result, null, 2));
```

## Next Steps

After successful setup:

1. ✅ Test with real menu
2. ✅ Train staff on new features
3. ✅ Monitor performance
4. ✅ Gather user feedback
5. ✅ Optimize based on usage

## Advanced Configuration

### Custom Hotspot Detection

Modify detection parameters in `/api/menu/detect-hotspots/route.ts`:

```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  temperature: 0.1,  // Lower = more consistent
  max_tokens: 2000,  // Adjust for larger menus
});
```

### Custom Image Optimization

Modify settings in `lib/image-utils.ts`:

```typescript
const options = {
  format: 'webp',
  quality: 80,      // 0-100
  maxWidth: 1920,   // pixels
  maxHeight: 1080,  // pixels
};
```

## Rollback Plan

If you need to disable hotspots:

1. **Disable in UI**:
   ```sql
   UPDATE menu_hotspots
   SET is_active = false
   WHERE venue_id = 'your_venue_id';
   ```

2. **Remove from code**:
   - Set `hotspotsEnabled` to `false` in component
   - System falls back to basic PDF display

3. **Drop table** (if needed):
   ```sql
   DROP TABLE menu_hotspots CASCADE;
   ```

## Success Metrics

Track these KPIs:

- **Hotspot Detection Rate**: % of items with hotspots
- **Click-Through Rate**: % of users clicking hotspots
- **Conversion Rate**: % of clicks resulting in cart additions
- **Average Session Time**: Time spent on menu page
- **Mobile Usage**: % of users on mobile devices

## Conclusion

You're all set! The hotspot system is now active and ready to enhance your menu experience.

For questions or issues, refer to:
- `HOTSPOT_SYSTEM.md` - Full documentation
- Console logs - Debug information
- Database - Data verification

Happy hotspotting! 🎉

