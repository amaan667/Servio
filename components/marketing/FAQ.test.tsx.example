/**
 * FAQ Component Tests
 * 
 * This test suite validates the FAQ component's functionality, accessibility, and interactions.
 * 
 * To run these tests, you'll need to set up a testing framework first:
 * 
 * 1. Install testing dependencies:
 *    ```bash
 *    pnpm add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jest jest-environment-jsdom
 *    ```
 * 
 * 2. Create jest.config.js:
 *    ```js
 *    module.exports = {
 *      testEnvironment: 'jsdom',
 *      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
 *      moduleNameMapper: {
 *        '^@/(.*)$': '<rootDir>/$1',
 *      },
 *    };
 *    ```
 * 
 * 3. Create jest.setup.js:
 *    ```js
 *    import '@testing-library/jest-dom';
 *    ```
 * 
 * 4. Add test script to package.json:
 *    ```json
 *    "test": "jest",
 *    "test:watch": "jest --watch"
 *    ```
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FAQ } from '@/components/marketing/FAQ';

describe('FAQ Component', () => {
  describe('Rendering', () => {
    it('renders the FAQ heading', () => {
      render(<FAQ />);
      expect(screen.getByRole('heading', { name: /frequently asked questions/i })).toBeInTheDocument();
    });

    it('renders all FAQ items', () => {
      render(<FAQ />);
      
      // Check for all 4 questions
      expect(screen.getByText(/do i need new hardware/i)).toBeInTheDocument();
      expect(screen.getByText(/can i try servio for free/i)).toBeInTheDocument();
      expect(screen.getByText(/how do customers place orders/i)).toBeInTheDocument();
      expect(screen.getByText(/is servio available outside the uk/i)).toBeInTheDocument();
    });

    it('renders CTA section with buttons', () => {
      render(<FAQ />);
      
      expect(screen.getByText(/still have questions/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /start free trial/i })).toBeInTheDocument();
    });

    it('has correct href for contact button', () => {
      render(<FAQ />);
      
      const contactLink = screen.getByRole('link', { name: /contact us/i });
      expect(contactLink).toHaveAttribute('href', 'mailto:support@servio.uk');
    });

    it('has correct href for trial button', () => {
      render(<FAQ />);
      
      const trialLink = screen.getByRole('link', { name: /start free trial/i });
      expect(trialLink).toHaveAttribute('href', '/sign-up');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes on buttons', () => {
      render(<FAQ />);
      
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-expanded');
        expect(button).toHaveAttribute('aria-controls');
      });
    });

    it('sets aria-expanded to false by default', () => {
      render(<FAQ />);
      
      const buttons = screen.getAllByRole('button');
      
      buttons.forEach(button => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('has region roles for answer sections', () => {
      render(<FAQ />);
      
      // There should be 4 regions (one for each FAQ answer)
      const regions = screen.getAllByRole('region');
      expect(regions).toHaveLength(4);
    });

    it('has proper heading hierarchy with h2', () => {
      render(<FAQ />);
      
      const heading = screen.getByRole('heading', { name: /frequently asked questions/i });
      expect(heading.tagName).toBe('H2');
    });

    it('has aria-labelledby on section', () => {
      render(<FAQ />);
      
      const section = screen.getByRole('region', { name: /frequently asked questions/i }).closest('section');
      expect(section).toHaveAttribute('aria-labelledby', 'faq-heading');
    });
  });

  describe('Interactions', () => {
    it('toggles FAQ item on click', async () => {
      const user = userEvent.setup();
      render(<FAQ />);
      
      const firstButton = screen.getAllByRole('button')[0];
      
      // Initially collapsed
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
      
      // Click to expand
      await user.click(firstButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      
      // Click to collapse
      await user.click(firstButton);
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggles FAQ item with keyboard (Enter key)', async () => {
      const user = userEvent.setup();
      render(<FAQ />);
      
      const firstButton = screen.getAllByRole('button')[0];
      
      // Focus the button
      firstButton.focus();
      
      // Press Enter
      await user.keyboard('{Enter}');
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
      
      // Press Enter again
      await user.keyboard('{Enter}');
      expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('toggles FAQ item with keyboard (Space key)', async () => {
      const user = userEvent.setup();
      render(<FAQ />);
      
      const firstButton = screen.getAllByRole('button')[0];
      
      // Focus the button
      firstButton.focus();
      
      // Press Space
      await user.keyboard(' ');
      expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('allows multiple items to be open simultaneously', async () => {
      const user = userEvent.setup();
      render(<FAQ />);
      
      const buttons = screen.getAllByRole('button');
      
      // Open first item
      await user.click(buttons[0]);
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
      
      // Open second item
      await user.click(buttons[1]);
      expect(buttons[1]).toHaveAttribute('aria-expanded', 'true');
      
      // First should still be open
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Analytics Callbacks', () => {
    it('calls onToggle callback when toggling FAQ', async () => {
      const user = userEvent.setup();
      const onToggle = jest.fn();
      
      render(<FAQ onToggle={onToggle} />);
      
      const firstButton = screen.getAllByRole('button')[0];
      
      // Open
      await user.click(firstButton);
      expect(onToggle).toHaveBeenCalledWith(
        'Do I need new hardware to use Servio?',
        true
      );
      
      // Close
      await user.click(firstButton);
      expect(onToggle).toHaveBeenCalledWith(
        'Do I need new hardware to use Servio?',
        false
      );
    });

    it('calls onCTAClick callback for contact button', async () => {
      const user = userEvent.setup();
      const onCTAClick = jest.fn();
      
      render(<FAQ onCTAClick={onCTAClick} />);
      
      const contactLink = screen.getByRole('link', { name: /contact us/i });
      
      await user.click(contactLink);
      expect(onCTAClick).toHaveBeenCalledWith('contact');
    });

    it('calls onCTAClick callback for trial button', async () => {
      const user = userEvent.setup();
      const onCTAClick = jest.fn();
      
      render(<FAQ onCTAClick={onCTAClick} />);
      
      const trialLink = screen.getByRole('link', { name: /start free trial/i });
      
      await user.click(trialLink);
      expect(onCTAClick).toHaveBeenCalledWith('trial');
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      const { container } = render(<FAQ className="custom-class" />);
      
      const section = container.querySelector('section');
      expect(section).toHaveClass('custom-class');
    });

    it('has chevron icons that rotate when open', async () => {
      const user = userEvent.setup();
      render(<FAQ />);
      
      const firstButton = screen.getAllByRole('button')[0];
      const chevron = firstButton.querySelector('svg');
      
      // Initially not rotated
      expect(chevron).not.toHaveClass('rotate-180');
      
      // Click to expand
      await user.click(firstButton);
      expect(chevron).toHaveClass('rotate-180');
    });
  });

  describe('Content', () => {
    it('displays bold text correctly', () => {
      render(<FAQ />);
      
      // The "No." and "14-day free trial" should be bold
      const buttons = screen.getAllByRole('button');
      
      // Click first item to reveal answer
      userEvent.click(buttons[0]);
      
      // Wait for content to appear
      setTimeout(() => {
        const boldText = screen.getByText('No.', { exact: false });
        expect(boldText.tagName).toBe('STRONG');
      }, 300);
    });
  });
});

describe('FAQ Schema', () => {
  it('exports valid JSON-LD schema', () => {
    const { faqSchema } = require('@/components/marketing/FAQ');
    
    expect(faqSchema).toHaveProperty('@context', 'https://schema.org');
    expect(faqSchema).toHaveProperty('@type', 'FAQPage');
    expect(faqSchema).toHaveProperty('mainEntity');
    expect(Array.isArray(faqSchema.mainEntity)).toBe(true);
    expect(faqSchema.mainEntity).toHaveLength(4);
  });

  it('schema has correct structure for each question', () => {
    const { faqSchema } = require('@/components/marketing/FAQ');
    
    faqSchema.mainEntity.forEach((item: any) => {
      expect(item).toHaveProperty('@type', 'Question');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('acceptedAnswer');
      expect(item.acceptedAnswer).toHaveProperty('@type', 'Answer');
      expect(item.acceptedAnswer).toHaveProperty('text');
    });
  });

  it('schema removes markdown from answers', () => {
    const { faqSchema } = require('@/components/marketing/FAQ');
    
    faqSchema.mainEntity.forEach((item: any) => {
      // Should not contain markdown bold markers
      expect(item.acceptedAnswer.text).not.toContain('**');
    });
  });
});

