/**
 * OpenAPI/Swagger Configuration
 * Comprehensive API documentation setup
 */

import swaggerJsdoc from "swagger-jsdoc";
import packageJson from "../../package.json";

const options: swaggerJsdoc.Options = {

      "error": "Error message",
      "details": {}
}
\`\`\`

## Status Codes

- \`200\` - Success
- \`400\` - Bad Request (validation error)
- \`401\` - Unauthorized
- \`403\` - Forbidden
- \`404\` - Not Found
- \`429\` - Rate Limited
- \`500\` - Internal Server Error
      `,

      },

      },
    },

      },
      {

      },
    ],

        },

        },
      },

          required: ["ok", "error"],

            },

            },

            },
          },
        },

          required: ["ok", "data"],

            },

            },
          },
        },

            },

            },

              enum: ["pending", "confirmed", "preparing", "ready", "served", "cancelled"],
            },

              enum: ["pending", "paid", "refunded"],
            },

            },

            },
          },
        },

            },

            },

            },

            },

            },

            },

            },
          },
        },

            },

            },

            },

            },
          },
        },
      },

              },

              },
            },
          },
        },

              },

              },
            },
          },
        },

              },

                  },
                ],
              },
            },
          },
        },

              },

              },
            },
          },
        },
      },
    },

      },
      {

      },
    ],

      },
      {

      },
      {

      },
      {

      },
      {

      },
      {

      },
      {

      },
      {

      },
    ],
  },
  apis: ["./app/api/**/*.ts", "./lib/api/**/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
