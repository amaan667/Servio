# 🎨 Settings Page - Visual Design Guide

## Color Palette

### Primary Colors
```css
Purple Gradient: from-purple-600 to-pink-600 (#8B5CF6 → #EC4899)
Purple Light: from-purple-50 to-pink-50 (backgrounds)
Blue Gradient: from-blue-50 to-indigo-50 (Security section)
```

### Accent Colors
```css
Success: Green-50, Green-200, Green-600, Green-800
Error/Destructive: Red-50, Red-200, Red-600
Warning: Amber-50, Amber-600
```

### Neutral Colors
```css
Borders: Gray-200 (#E5E7EB)
Backgrounds: Gray-50 (#F9FAFB)
Text Muted: Muted-foreground (from theme)
```

## Layout Structure

### Desktop Layout (> 1024px)
```
┌─────────────────────────────────────────────────────────┐
│  Breadcrumb Navigation                                  │
│  Settings for [Venue Name]                             │
│  Manage your venue settings and preferences             │
├─────────────────────────┬───────────────────────────────┤
│ LEFT COLUMN             │ RIGHT COLUMN                  │
│                         │                               │
│ ┌─────────────────────┐ │ ┌───────────────────────────┐ │
│ │ Account Information │ │ │ Venue Settings            │ │
│ │ (Purple header)     │ │ │ (Purple header)           │ │
│ │ - Email (read-only) │ │ │ - Venue Name              │ │
│ │ - Full Name         │ │ │ - Venue Type (dropdown)   │ │
│ └─────────────────────┘ │ │ - Service Type (radio)    │ │
│                         │ │ - Timezone (dropdown)     │ │
│ ┌─────────────────────┐ │ │ - Email                   │ │
│ │ Security Settings   │ │ │ - Phone                   │ │
│ │ (Blue header)       │ │ │ - Address (enhanced)      │ │
│ │ ▼ Password Mgmt     │ │ │   + Map Preview           │ │
│ │ ▼ 2FA (coming soon) │ │ │ ▼ Operating Hours         │ │
│ └─────────────────────┘ │ └───────────────────────────┘ │
│                         │                               │
└─────────────────────────┴───────────────────────────────┘
│ ┌───────────────────────────────────────────────────┐   │
│ │ Danger Zone (Red header)                          │   │
│ │ - Delete Account (enhanced confirmation)          │   │
│ └───────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                                        ┌──────────────┐
                                        │ Save Changes │ (Sticky)
                                        └──────────────┘
```

### Mobile Layout (< 768px)
```
┌───────────────────────────────┐
│ Breadcrumb                    │
│ Settings for [Venue Name]     │
├───────────────────────────────┤
│ ┌──────────────────────────┐  │
│ │ Account Information      │  │
│ └──────────────────────────┘  │
│                               │
│ ┌──────────────────────────┐  │
│ │ Security Settings        │  │
│ └──────────────────────────┘  │
│                               │
│ ┌──────────────────────────┐  │
│ │ Venue Settings           │  │
│ └──────────────────────────┘  │
│                               │
│ ┌──────────────────────────┐  │
│ │ Danger Zone              │  │
│ └──────────────────────────┘  │
│                               │
└───────────────────────────────┘
┌───────────────────────────────┐
│     💾 Save Changes           │ (Fixed bottom)
└───────────────────────────────┘
┌───────────────────────────────┐
│   📱 Mobile Navigation        │
└───────────────────────────────┘
```

## Component Breakdown

### 1. Card Component
```jsx
<Card className="shadow-lg rounded-xl border-gray-200">
  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
    <CardTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-purple-600" />
      Section Title
    </CardTitle>
    <CardDescription>Section description</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4 pt-6">
    {/* Content */}
  </CardContent>
</Card>
```

**Visual Details:**
- Shadow: `shadow-lg` (large shadow for depth)
- Border Radius: `rounded-xl` (12px)
- Border Color: `border-gray-200`
- Header Background: Gradient (purple-50 to pink-50)
- Header Rounded: `rounded-t-xl` (top corners only)
- Content Padding: `pt-6` (top padding after header)
- Content Spacing: `space-y-4` (16px between items)

### 2. Input Fields
```jsx
<div>
  <Label htmlFor="fieldName" className="flex items-center gap-2">
    <Icon className="h-4 w-4" />
    Field Label
  </Label>
  <Input
    id="fieldName"
    value={value}
    onChange={onChange}
    placeholder="Placeholder text"
    className="rounded-lg border-gray-200 mt-1"
  />
  <p className="text-xs text-muted-foreground mt-1">
    Helper text
  </p>
</div>
```

**Visual Details:**
- Label: Icon + text, 16px gap
- Input Border Radius: `rounded-lg` (8px)
- Input Border: `border-gray-200`
- Input Margin Top: `mt-1` (4px from label)
- Helper Text: `text-xs`, muted color, 4px margin

### 3. Dropdown (Select)
```jsx
<Select value={value} onValueChange={onChange}>
  <SelectTrigger className="rounded-lg border-gray-200 mt-1">
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

**Visual Details:**
- Trigger Border Radius: `rounded-lg`
- Trigger Border: `border-gray-200`
- Content: Dropdown list with hover states
- Options: Padding for touch targets

### 4. Radio Group
```jsx
<RadioGroup value={value} onValueChange={onChange}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <Label htmlFor="option1" className="font-normal cursor-pointer">
      Option 1
    </Label>
  </div>
</RadioGroup>
```

**Visual Details:**
- Items: Vertical spacing `space-y-2`
- Radio + Label: Horizontal `space-x-2`
- Label: Normal font weight, cursor pointer
- Radio: Theme colors with hover/focus states

### 5. Accordion (Collapsible)
```jsx
<Accordion type="single" collapsible>
  <AccordionItem value="item1">
    <AccordionTrigger className="hover:no-underline">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        Section Title
      </div>
    </AccordionTrigger>
    <AccordionContent>
      {/* Content */}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Visual Details:**
- Trigger: No underline on hover
- Icon: 16x16px with 8px gap
- Content: Smooth expand/collapse animation
- Padding: Appropriate spacing for content

### 6. Buttons

#### Primary (Save)
```jsx
<Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
  <Save className="h-5 w-5 mr-2" />
  Save Changes
</Button>
```

**Visual Details:**
- Background: Purple to pink gradient
- Hover: Darker gradient (700 shades)
- Icon: 20x20px with 8px margin right
- Border Radius: Default button radius
- Padding: Large (`size="lg"`)

#### Secondary (Outline)
```jsx
<Button variant="outline" className="rounded-lg">
  Button Text
</Button>
```

**Visual Details:**
- Border: Gray outline
- Background: Transparent
- Hover: Light gray background
- Border Radius: `rounded-lg`

#### Destructive (Delete)
```jsx
<Button variant="destructive">
  <Trash2 className="h-4 w-4 mr-2" />
  Delete Account
</Button>
```

**Visual Details:**
- Background: Red (destructive color)
- Hover: Darker red
- Icon: 16x16px with 8px margin
- Text: White

### 7. Toast Notifications

#### Success
```jsx
toast({
  title: "Success",
  description: "✅ Venue settings updated successfully!",
  duration: 3000,
});
```

**Visual Details:**
- Position: Top-right or bottom-center (based on theme)
- Duration: 3 seconds
- Icon: Green checkmark
- Background: Green-50
- Border: Green-200
- Auto-dismiss: Yes

#### Error
```jsx
toast({
  title: "Error",
  description: error.message,
  variant: "destructive",
});
```

**Visual Details:**
- Variant: Destructive (red theme)
- Background: Red-50
- Border: Red-200
- Text: Red-800
- Icon: Alert triangle

### 8. Alert Messages
```jsx
<Alert className="bg-green-50 border-green-200">
  <CheckCircle2 className="h-4 w-4 text-green-600" />
  <AlertDescription className="text-green-800">
    Success message
  </AlertDescription>
</Alert>
```

**Visual Details:**
- Background: Context color (green for success)
- Border: Matching border color
- Icon: 16x16px, colored
- Text: Darker shade of context color
- Border Radius: Default (rounded)

### 9. Enhanced Address Input

#### With Map Preview
```
┌─────────────────────────────────────┐
│ 📍 Venue Address (with autocomplete)│
├─────────────────────────────────────┤
│ [Input field - autocomplete enabled] │
│ "Start typing and select..."         │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │      [Map Preview]              │ │
│ │      OpenStreetMap Embed        │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ 📍 Location preview (approximate)   │
└─────────────────────────────────────┘
```

**Visual Details:**
- Input: Standard input with icon
- Autocomplete: Google Places dropdown (if configured)
- Map Container: Card with rounded corners
- Map Height: 192px (h-48)
- Map Border: None
- Footer: Gray-50 background with location text

### 10. Operating Hours Section
```
▶ Operating Hours (Optional)
  
  When expanded:
  
  Monday    [09:00] to [17:00]  ☑ Closed
  Tuesday   [09:00] to [17:00]  ☐ Closed
  ...
```

**Visual Details:**
- Container: Accordion with border
- Day Rows: Gray-50 background, rounded-lg
- Day Label: 96px width, capitalized
- Time Inputs: Inline, rounded-lg
- "to" separator: Text between inputs
- Switch: Toggle for closed status
- Spacing: 12px between rows (space-y-3)

### 11. Sticky Save Button

#### Desktop
```
                              ┌────────────────┐
                              │ 💾 Save        │
                              │    Changes     │
                              └────────────────┘
                              Fixed: bottom-right
                              Shadow: 2xl
                              Z-index: 50
```

#### Mobile
```
┌─────────────────────────────────────┐
│  💾 Save Changes                    │
└─────────────────────────────────────┘
Fixed: bottom (above mobile nav)
Full width
Background: Background color with border-top
```

**Visual Details:**
- Desktop: Bottom-right, padding from edges
- Mobile: Full-width, above navigation
- Shadow: `shadow-2xl` (desktop only)
- Background: Purple-pink gradient
- Size: Large (`size="lg"`)
- Text: White, medium weight
- Only visible: When there are unsaved changes

## Icons Used (Lucide React)

| Section | Icon | Size | Color |
|---------|------|------|-------|
| Account Info | `User` | 20x20 | Purple-600 |
| Email | `Mail` | 16x16 | Default |
| Building | `Building` | 16x16 | Default |
| Phone | `Phone` | 16x16 | Default |
| Address | `MapPin` | 16x16 | Default |
| Security | `Shield` | 20x20 | Blue-600 |
| Password | `Lock` | 16x16 | Default |
| Venue Settings | `Store` | 20x20 | Purple-600 |
| Timezone | `Globe` | 16x16 | Default |
| Venue Type | `Utensils` | 16x16 | Default |
| Hours | `Clock` | 16x16 | Default |
| Danger Zone | `AlertTriangle` | 20x20 | Red-600 |
| Delete | `Trash2` | 16x16 | White |
| Save | `Save` | 20x20 | White |
| Success | `CheckCircle2` | 16x16 | Green-600 |
| Loading | `Loader2` | 16x16 | Animated spin |

## Spacing System

### Card Spacing
- Padding: `p-6` (24px)
- Content Padding Top: `pt-6` after header
- Space Between Items: `space-y-4` (16px)

### Section Spacing
- Between Cards: `space-y-6` (24px)
- Grid Gap: `gap-6` (24px)

### Form Field Spacing
- Label to Input: `mt-1` (4px)
- Input to Helper Text: `mt-1` (4px)
- Between Fields: `space-y-4` (16px)

### Button Spacing
- Icon to Text: `mr-2` (8px)
- Between Buttons: `gap-2` (8px)

## Responsive Breakpoints

```css
Mobile:  0px    - 767px   (single column)
Tablet:  768px  - 1023px  (single column, better spacing)
Desktop: 1024px+           (two column grid)
```

### Container Max Width
```css
max-w-7xl (1280px)
```

### Grid Configuration
```css
Desktop: grid-cols-1 lg:grid-cols-2
Mobile:  grid-cols-1
```

## Animation & Transitions

### Accordion
- Expand/Collapse: Smooth height transition
- Duration: 200ms
- Easing: Ease-in-out

### Buttons
- Hover: Background color transition
- Duration: 150ms
- Easing: Ease-in-out

### Toast
- Enter: Slide in from top-right
- Exit: Fade out
- Duration: 300ms

### Save Button Appearance
- Fade in: When unsaved changes detected
- Fade out: After successful save
- Duration: 200ms

## Typography

### Headings
- Page Title: `text-3xl font-bold tracking-tight`
- Card Title: `CardTitle` component (default styling)
- Section Description: `CardDescription` component

### Body Text
- Labels: `Label` component
- Input: Default input font
- Helper Text: `text-xs text-muted-foreground`
- Muted: `text-muted-foreground`

### Font Weights
- Bold: `font-bold` (titles)
- Semibold: `font-semibold` (labels)
- Medium: `font-medium` (card titles)
- Normal: `font-normal` (body text)

## Accessibility

### Focus States
- All interactive elements have visible focus rings
- Focus ring color: Primary theme color
- Focus ring width: 2px
- Focus ring offset: 2px

### ARIA Labels
- All inputs have associated labels
- Buttons have descriptive text or aria-labels
- Dialogs have proper ARIA roles

### Keyboard Navigation
- Tab order follows visual hierarchy
- Escape closes dialogs
- Enter submits forms
- Space toggles switches/checkboxes

### Screen Readers
- Icons accompanied by text
- Helper text linked to inputs
- Error messages announced
- Success messages announced

## Dark Mode Support

The design uses theme variables that automatically adapt to dark mode:
- `background` - Page background
- `foreground` - Text color
- `card` - Card background
- `border` - Border color
- `muted` - Muted text
- `accent` - Accent color

Custom colors (gradients) remain consistent across themes for brand identity.

---

This visual guide ensures consistent, professional, and accessible design throughout the Settings page! 🎨

