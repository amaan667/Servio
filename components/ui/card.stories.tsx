import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content goes here. This is where you would put the main content of your card.</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card with Footer</CardTitle>
        <CardDescription>This card includes a footer section</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Main content of the card.</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Save</Button>
      </CardFooter>
    </Card>
  ),
};

export const StatsCard: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
        <Badge variant="secondary">+20.1%</Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">$45,231.89</div>
        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
      </CardContent>
    </Card>
  ),
};

export const OrderCard: Story = {
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Order #12345</CardTitle>
          <Badge variant="outline">Pending</Badge>
        </div>
        <CardDescription>Table 5 • 2:30 PM</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Burger Deluxe</span>
            <span>$12.99</span>
          </div>
          <div className="flex justify-between">
            <span>Fries</span>
            <span>$4.99</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>$17.98</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1">
          View Details
        </Button>
        <Button className="flex-1">Accept Order</Button>
      </CardFooter>
    </Card>
  ),
};

export const MenuItemCard: Story = {
  render: () => (
    <Card className="w-[300px]">
      <CardHeader>
        <CardTitle>Chicken Caesar Salad</CardTitle>
        <CardDescription>Fresh romaine, grilled chicken, parmesan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold">$14.99</span>
          <Badge variant="secondary">Available</Badge>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Add to Order</Button>
      </CardFooter>
    </Card>
  ),
};

export const AnalyticsCard: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Today&apos;s Performance</CardTitle>
        <CardDescription>Real-time metrics for your venue</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">24</div>
            <div className="text-sm text-muted-foreground">Orders</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">$1,234</div>
            <div className="text-sm text-muted-foreground">Revenue</div>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">156</div>
          <p className="text-xs text-muted-foreground">+12% from last week</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Average Order Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">$23.45</div>
          <p className="text-xs text-muted-foreground">+5% from last week</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer Satisfaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">4.8/5</div>
          <p className="text-xs text-muted-foreground">Based on 89 reviews</p>
        </CardContent>
      </Card>
    </div>
  ),
};
