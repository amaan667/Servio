import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";

const meta: Meta<typeof Card> = {

  },

};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {

};

export const WithFooter: Story = {

};

export const StatsCard: Story = {

        <div className="text-2xl font-bold">$45,231.89</div>
        <p className="text-xs text-muted-foreground">+20.1% from last month</p>
      </CardContent>
    </Card>
  ),
};

export const OrderCard: Story = {

};

export const MenuItemCard: Story = {

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

            <div className="text-2xl font-bold">$1,234</div>
            <div className="text-sm text-muted-foreground">Revenue</div>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const MultipleCards: Story = {

};
