import { NextResponse } from "next/server";
import swaggerJsdoc from "swagger-jsdoc";

const options = {

      },
    },

      },
    ],

        },
      },

            id: { type: "string", format: "uuid" },
            venue_id: { type: "string", format: "uuid" },
            table_id: { type: "string", format: "uuid", nullable: true },
            customer_name: { type: "string" },
            customer_phone: { type: "string" },

              items: { $ref: "#/components/schemas/OrderItem" },
            },
            total_amount: { type: "number", format: "decimal" },

              enum: ["PLACED", "ACCEPTED", "IN_PREP", "READY", "SERVING", "COMPLETED", "CANCELLED"],
            },

              enum: ["UNPAID", "PAID", "TILL", "REFUNDED"],
            },
            created_at: { type: "string", format: "date-time" },
          },
        },

            menu_item_id: { type: "string", format: "uuid", nullable: true },
            quantity: { type: "integer", minimum: 1 },
            price: { type: "number", format: "decimal" },
            item_name: { type: "string" },
            specialInstructions: { type: "string", nullable: true },
          },
        },

            ok: { type: "boolean" },
            error: { type: "string" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },

};

export async function GET() {
  try {
    const swaggerSpec = swaggerJsdoc(options);
    return NextResponse.json(swaggerSpec);
  } catch {
    return NextResponse.json({ error: "Failed to generate API documentation" }, { status: 500 });
  }
}
