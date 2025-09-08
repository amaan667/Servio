-- =====================================================
-- ATOMIC REPLACE CATALOG RPC FUNCTION
-- =====================================================
-- This function provides atomic catalog replacement with proper validation
-- and rollback on any failure

CREATE OR REPLACE FUNCTION api_replace_catalog(
  p_venue_id TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_category JSONB;
  v_item JSONB;
  v_option JSONB;
  v_choice JSONB;
  v_alias TEXT;
  v_cat_id UUID;
  v_item_id UUID;
  v_opt_id UUID;
  v_result JSONB;
  v_items_count INTEGER := 0;
  v_categories_count INTEGER := 0;
  v_options_count INTEGER := 0;
  v_aliases_count INTEGER := 0;
  v_images_count INTEGER := 0;
BEGIN
  -- Validate venue exists
  IF NOT EXISTS (SELECT 1 FROM venues WHERE venue_id = p_venue_id) THEN
    RAISE EXCEPTION 'Venue % does not exist', p_venue_id;
  END IF;

  -- Validate payload structure
  IF NOT (p_payload ? 'categories' AND jsonb_typeof(p_payload->'categories') = 'array') THEN
    RAISE EXCEPTION 'Invalid payload: missing or invalid categories array';
  END IF;

  -- Begin transaction (implicit in function)

  -- 1) HARD CLEAR existing catalog for this venue (order matters for FK constraints)
  DELETE FROM item_images WHERE venue_id = p_venue_id;
  DELETE FROM item_aliases WHERE venue_id = p_venue_id;
  DELETE FROM option_choices WHERE venue_id = p_venue_id;
  DELETE FROM options WHERE venue_id = p_venue_id;
  DELETE FROM menu_items WHERE venue_id = p_venue_id;
  DELETE FROM categories WHERE venue_id = p_venue_id;

  -- 2) INSERT categories first
  FOR v_category IN
    SELECT * FROM jsonb_array_elements(p_payload->'categories')
  LOOP
    -- Validate category has required fields
    IF NOT (v_category ? 'name' AND v_category->>'name' IS NOT NULL) THEN
      RAISE EXCEPTION 'Category missing required name field';
    END IF;

    INSERT INTO categories (id, venue_id, name, sort_order)
    VALUES (
      COALESCE((v_category->>'id')::uuid, gen_random_uuid()),
      p_venue_id,
      v_category->>'name',
      COALESCE((v_category->>'sort_order')::int, v_categories_count)
    )
    RETURNING id INTO v_cat_id;

    v_categories_count := v_categories_count + 1;

    -- 3) INSERT items for this category
    FOR v_item IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_category->'items', '[]'::jsonb))
    LOOP
      -- Validate item has required fields
      IF NOT (v_item ? 'title' AND v_item->>'title' IS NOT NULL) THEN
        RAISE EXCEPTION 'Item missing required title field';
      END IF;

      -- CRITICAL: Reject £0.00 prices to prevent bad data
      IF COALESCE((v_item->>'price')::numeric, 0) <= 0 THEN
        RAISE EXCEPTION 'Invalid price (0 or negative) for item: %', v_item->>'title';
      END IF;

      INSERT INTO menu_items (
        id, venue_id, category_id, name, subtitle, description, 
        price, currency, available, sort_order
      )
      VALUES (
        COALESCE((v_item->>'id')::uuid, gen_random_uuid()),
        p_venue_id,
        v_cat_id,
        v_item->>'title',
        v_item->>'subtitle',
        v_item->>'description',
        (v_item->>'price')::numeric,
        COALESCE(v_item->>'currency', 'GBP'),
        COALESCE((v_item->>'available')::boolean, true),
        COALESCE((v_item->>'sort_order')::int, v_items_count)
      )
      RETURNING id INTO v_item_id;

      v_items_count := v_items_count + 1;

      -- 4) INSERT aliases
      IF v_item ? 'aliases' AND jsonb_typeof(v_item->'aliases') = 'array' THEN
        FOR v_alias IN
          SELECT * FROM jsonb_array_elements_text(v_item->'aliases')
        LOOP
          IF v_alias IS NOT NULL AND TRIM(v_alias) != '' THEN
            INSERT INTO item_aliases (venue_id, item_id, alias)
            VALUES (p_venue_id, v_item_id, TRIM(v_alias));
            v_aliases_count := v_aliases_count + 1;
          END IF;
        END LOOP;
      END IF;

      -- 5) INSERT options (attach by group)
      IF v_item ? 'options' AND jsonb_typeof(v_item->'options') = 'array' THEN
        FOR v_option IN
          SELECT * FROM jsonb_array_elements(v_item->'options')
        LOOP
          -- Validate option has required fields
          IF NOT (v_option ? 'group' AND v_option->>'group' IS NOT NULL) THEN
            RAISE EXCEPTION 'Option missing required group field for item: %', v_item->>'title';
          END IF;

          INSERT INTO options (
            venue_id, item_id, group_name, is_required, max_choices, sort_order
          )
          VALUES (
            p_venue_id, v_item_id,
            v_option->>'group',
            COALESCE((v_option->>'required')::boolean, false),
            COALESCE((v_option->>'max')::int, 1),
            COALESCE((v_option->>'sort_order')::int, 0)
          )
          RETURNING id INTO v_opt_id;

          v_options_count := v_options_count + 1;

          -- 6) INSERT option choices
          IF v_option ? 'choices' AND jsonb_typeof(v_option->'choices') = 'array' THEN
            FOR v_choice IN
              SELECT * FROM jsonb_array_elements(v_option->'choices')
            LOOP
              -- Validate choice has required fields
              IF NOT (v_choice ? 'name' AND v_choice->>'name' IS NOT NULL) THEN
                RAISE EXCEPTION 'Choice missing required name field for option: %', v_option->>'group';
              END IF;

              INSERT INTO option_choices (
                venue_id, option_id, name, price_add_cents, sort_order
              )
              VALUES (
                p_venue_id, v_opt_id,
                v_choice->>'name',
                COALESCE(((v_choice->>'price_add')::numeric * 100)::int, 0),
                COALESCE((v_choice->>'sort_order')::int, 0)
              );
            END LOOP;
          END IF;
        END LOOP;
      END IF;

      -- 7) INSERT images (optional)
      IF p_payload ? 'images_base_url' AND v_item ? 'image' AND v_item->>'image' IS NOT NULL THEN
        INSERT INTO item_images (venue_id, item_id, url, sort_order)
        VALUES (
          p_venue_id, v_item_id, 
          (p_payload->>'images_base_url') || '/' || (v_item->>'image'),
          COALESCE((v_item->>'image_sort_order')::int, 0)
        );
        v_images_count := v_images_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Build result
  v_result := jsonb_build_object(
    'success', true,
    'venue_id', p_venue_id,
    'categories_created', v_categories_count,
    'items_created', v_items_count,
    'options_created', v_options_count,
    'aliases_created', v_aliases_count,
    'images_created', v_images_count,
    'timestamp', NOW()
  );

  -- Transaction will commit if we reach here
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will rollback automatically
    RAISE EXCEPTION 'Catalog replacement failed: %', SQLERRM;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION api_replace_catalog(TEXT, JSONB) TO authenticated;

-- =====================================================
-- VALIDATION FUNCTION
-- =====================================================
-- Helper function to validate catalog payload before replacement
CREATE OR REPLACE FUNCTION validate_catalog_payload(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_category JSONB;
  v_item JSONB;
  v_errors TEXT[] := '{}';
  v_warnings TEXT[] := '{}';
  v_items_count INTEGER := 0;
  v_zero_price_count INTEGER := 0;
  v_missing_price_count INTEGER := 0;
BEGIN
  -- Check payload structure
  IF NOT (p_payload ? 'categories' AND jsonb_typeof(p_payload->'categories') = 'array') THEN
    v_errors := array_append(v_errors, 'Missing or invalid categories array');
    RETURN jsonb_build_object('valid', false, 'errors', to_jsonb(v_errors));
  END IF;

  -- Validate each category and item
  FOR v_category IN
    SELECT * FROM jsonb_array_elements(p_payload->'categories')
  LOOP
    IF NOT (v_category ? 'name' AND v_category->>'name' IS NOT NULL) THEN
      v_errors := array_append(v_errors, 'Category missing name');
      CONTINUE;
    END IF;

    FOR v_item IN
      SELECT * FROM jsonb_array_elements(COALESCE(v_category->'items', '[]'::jsonb))
    LOOP
      v_items_count := v_items_count + 1;

      -- Check required fields
      IF NOT (v_item ? 'title' AND v_item->>'title' IS NOT NULL) THEN
        v_errors := array_append(v_errors, 'Item missing title');
        CONTINUE;
      END IF;

      -- Check price
      IF NOT (v_item ? 'price') THEN
        v_missing_price_count := v_missing_price_count + 1;
        v_errors := array_append(v_errors, 'Item "' || (v_item->>'title') || '" missing price');
      ELSIF COALESCE((v_item->>'price')::numeric, 0) <= 0 THEN
        v_zero_price_count := v_zero_price_count + 1;
        v_errors := array_append(v_errors, 'Item "' || (v_item->>'title') || '" has invalid price: ' || (v_item->>'price'));
      END IF;
    END LOOP;
  END LOOP;

  -- Add warnings for suspicious patterns
  IF v_items_count > 100 THEN
    v_warnings := array_append(v_warnings, 'Large number of items (' || v_items_count || ') - check for modifier explosion');
  END IF;

  IF v_zero_price_count > 0 THEN
    v_warnings := array_append(v_warnings, 'Found ' || v_zero_price_count || ' items with zero prices');
  END IF;

  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', to_jsonb(v_errors),
    'warnings', to_jsonb(v_warnings),
    'items_count', v_items_count,
    'zero_price_count', v_zero_price_count,
    'missing_price_count', v_missing_price_count
  );
END;
$$;

-- Grant permissions for validation function
GRANT EXECUTE ON FUNCTION validate_catalog_payload(JSONB) TO authenticated;
