import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { Download, Settings, Plus, Trash2 } from "lucide-react";

const meta: Meta<typeof Button> = {

  },

      control: { type: "select" },
      options: ["default", "destructive", "outline", "secondary", "ghost", "link", "servio"],
    },

      control: { type: "select" },
      options: ["default", "sm", "lg", "icon", "mobile"],
    },

      control: { type: "boolean" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {

  },
};

export const Destructive: Story = {

  },
};

export const Outline: Story = {

  },
};

export const Secondary: Story = {

  },
};

export const Ghost: Story = {

  },
};

export const Link: Story = {

  },
};

export const Servio: Story = {

  },
};

export const Small: Story = {

  },
};

export const Large: Story = {

  },
};

export const Icon: Story = {

  },
};

export const Mobile: Story = {

  },
};

export const WithIcon: Story = {

  },
};

export const Loading: Story = {

  },
};

export const Disabled: Story = {

  },
};

export const DestructiveWithIcon: Story = {

  },
};

export const AddButton: Story = {

  },
};

export const AllVariants: Story = {

};

export const AllSizes: Story = {

};
