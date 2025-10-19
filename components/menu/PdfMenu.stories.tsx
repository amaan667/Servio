import type { Meta, StoryObj } from '@storybook/react';
import { PdfMenu, PdfMenuWithCart } from './PdfMenu';

const meta: Meta<typeof PdfMenu> = {
  title: 'Menu/PdfMenu',
  component: PdfMenu,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A reusable PDF menu viewer with pixel-perfect clickable overlays. Supports direct PDF rendering with pdfjs-dist and provides precise coordinate scaling for interactive hotspots.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PdfMenu>;

// Demo items for overlay hotspots
const demoItems = [
  {
    id: 'burger-1',
    page: 0,
    x: 100,
    y: 200,
    w: 150,
    h: 50,
    name: 'Classic Burger',
    priceMinor: 1299,
  },
  {
    id: 'pizza-1',
    page: 0,
    x: 300,
    y: 200,
    w: 150,
    h: 50,
    name: 'Margherita Pizza',
    priceMinor: 1599,
  },
  {
    id: 'salad-1',
    page: 0,
    x: 500,
    y: 200,
    w: 150,
    h: 50,
    name: 'Caesar Salad',
    priceMinor: 899,
  },
  {
    id: 'drink-1',
    page: 0,
    x: 100,
    y: 400,
    w: 120,
    h: 40,
    name: 'Coca Cola',
    priceMinor: 299,
  },
];

/**
 * Basic PdfMenu with debug mode enabled to visualize hitboxes
 */
export const WithDebugMode: Story = {
  args: {
    src: '/sample-menu.pdf',
    items: demoItems,
    scale: 1.5,
    debug: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Debug mode shows red borders around overlay hitboxes and displays item IDs. Useful for verifying pixel-perfect alignment.',
      },
    },
  },
};

/**
 * PdfMenu with click handlers
 */
export const WithClickHandlers: Story = {
  args: {
    src: '/sample-menu.pdf',
    items: demoItems,
    scale: 1.5,
    debug: false,
    onItemClick: (id) => {
      console.log('Clicked item:', id);
      alert(`Clicked: ${id}`);
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Click handlers allow you to respond to user interactions with overlay items.',
      },
    },
  },
};

/**
 * PdfMenu with cart functionality
 */
export const WithCart: Story = {
  render: () => {
    const cart = [
      { id: 'burger-1', quantity: 2 },
      { id: 'drink-1', quantity: 1 },
    ];

    return (
      <PdfMenuWithCart
        src="/sample-menu.pdf"
        items={demoItems}
        cart={cart}
        scale={1.5}
        onAddToCart={(item) => console.log('Add to cart:', item)}
        onUpdateQuantity={(id, qty) => console.log('Update quantity:', id, qty)}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'PdfMenuWithCart shows +/- buttons for items in cart and allows adding new items. Perfect for ordering interfaces.',
      },
    },
  },
};

/**
 * PdfMenu with different scale factors
 */
export const DifferentScales: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-2">Scale 1.0 (100%)</h3>
        <PdfMenu
          src="/sample-menu.pdf"
          items={demoItems}
          scale={1.0}
          debug={true}
        />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Scale 1.5 (150%)</h3>
        <PdfMenu
          src="/sample-menu.pdf"
          items={demoItems}
          scale={1.5}
          debug={true}
        />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Scale 2.0 (200%)</h3>
        <PdfMenu
          src="/sample-menu.pdf"
          items={demoItems}
          scale={2.0}
          debug={true}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different scale factors demonstrate pixel-perfect hitbox scaling. All scales maintain accurate overlay positioning.',
      },
    },
  },
};

/**
 * Empty state with no items
 */
export const EmptyState: Story = {
  args: {
    src: '/sample-menu.pdf',
    items: [],
    scale: 1.5,
  },
  parameters: {
    docs: {
      description: {
        story: 'PdfMenu gracefully handles empty items array, showing just the PDF without overlays.',
      },
    },
  },
};

/**
 * Multi-page PDF
 */
export const MultiPage: Story = {
  args: {
    src: '/sample-menu.pdf',
    items: [
      ...demoItems,
      {
        id: 'dessert-1',
        page: 1,
        x: 200,
        y: 300,
        w: 150,
        h: 50,
        name: 'Chocolate Cake',
        priceMinor: 799,
      },
    ],
    scale: 1.5,
    debug: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Multi-page PDFs are fully supported. Items can be placed on any page using the page index.',
      },
    },
  },
};

/**
 * Loading state
 */
export const Loading: Story = {
  render: () => (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Loading state is shown while the PDF is being fetched and rendered.',
      },
    },
  },
};

/**
 * Error state
 */
export const ErrorState: Story = {
  render: () => (
    <div className="text-center py-12">
      <p className="text-red-600 mb-2">Error loading PDF</p>
      <p className="text-sm text-gray-500">Failed to load PDF</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Error state is shown when PDF loading fails. Error messages are displayed to help with debugging.',
      },
    },
  },
};

