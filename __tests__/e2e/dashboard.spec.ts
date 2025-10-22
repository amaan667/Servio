/**
 * Dashboard E2E Tests
 * Tests the complete user journey from authentication to dashboard interaction
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should redirect to sign-in when not authenticated', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard/venue-123');
    
    // Should show sign-in message
    await expect(page.getByText('Please sign in to access this venue')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Sign In' })).toBeVisible();
  });

  test('should load dashboard after authentication', async ({ page }) => {
    // Mock authentication (in real test, you'd use actual auth flow)
    await page.addInitScript(() => {
      // Mock Supabase session
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000
      }));
    });

    // Mock API responses
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com'
        })
      });
    });

    await page.route('**/rest/v1/venues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          venue_id: 'venue-123',
          venue_name: 'Test Venue',
          owner_user_id: 'user-123'
        }])
      });
    });

    await page.goto('/dashboard/venue-123');
    
    // Should load dashboard successfully
    await expect(page.getByText('Test Venue')).toBeVisible();
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });

  test('should show access denied for unauthorized venue', async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000
      }));
    });

    // Mock API responses for unauthorized access
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com'
        })
      });
    });

    await page.route('**/rest/v1/venues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]) // No venues returned
      });
    });

    await page.goto('/dashboard/venue-123');
    
    // Should show access denied
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('You don\'t have access to this venue')).toBeVisible();
  });

  test('should handle real-time updates', async ({ page }) => {
    // Mock authentication and initial data
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000
      }));
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com'
        })
      });
    });

    await page.route('**/rest/v1/venues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          venue_id: 'venue-123',
          venue_name: 'Test Venue',
          owner_user_id: 'user-123'
        }])
      });
    });

    await page.goto('/dashboard/venue-123');
    
    // Wait for dashboard to load
    await expect(page.getByText('Test Venue')).toBeVisible();
    
    // Test real-time updates (mock WebSocket)
    await page.evaluate(() => {
      // Simulate real-time update
      window.dispatchEvent(new CustomEvent('supabase:update', {
        detail: { table: 'orders', new: { id: 'order-123', total: 25.50 } }
      }));
    });

    // Should handle real-time updates gracefully
    await expect(page.getByTestId('dashboard')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000
      }));
    });

    // Mock network error
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/dashboard/venue-123');
    
    // Should handle error gracefully
    await expect(page.getByText('Authentication failed')).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mock authentication and data
    await page.addInitScript(() => {
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() + 3600000
      }));
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com'
        })
      });
    });

    await page.route('**/rest/v1/venues*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          venue_id: 'venue-123',
          venue_name: 'Test Venue',
          owner_user_id: 'user-123'
        }])
      });
    });

    await page.goto('/dashboard/venue-123');
    
    // Should be responsive
    await expect(page.getByText('Test Venue')).toBeVisible();
    
    // Check mobile-specific elements
    await expect(page.getByTestId('mobile-nav')).toBeVisible();
  });
});