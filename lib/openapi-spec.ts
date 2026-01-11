/**
 * OpenAPI 3.0 specification for Servio API
 * This can be used to generate interactive API documentation
 */

export const openApiSpec = {

    },

    },
  },

    },
    {

    },
  ],

    },
  ],

        security: [{ cookieAuth: [] }],

                      },
                    },
                  },
                },
              },
            },
          },
          "401": {

                },
              },
            },
          },
        },
      },
    },
    "/orders": {

        security: [{ cookieAuth: [] }],

            },

          },
          {

              enum: ["pending", "preparing", "ready", "completed", "cancelled"],
            },

          },
          {

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
    "/menu-items": {

        security: [{ cookieAuth: [] }],

            },

          },
          {

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

        security: [{ cookieAuth: [] }],

              },
            },
          },
        },

                },
              },
            },
          },
          "400": {

                },
              },
            },
          },
        },
      },
    },
    "/analytics/revenue": {

        security: [{ cookieAuth: [] }],

            },

          },
          {

            },

          },
          {

            },

          },
          {

              enum: ["day", "week", "month"],

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
    "/qr-codes/generate": {

        security: [{ cookieAuth: [] }],

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
        required: ["venue_id", "venue_name", "owner_user_id"],
      },

          },

          },

          },

            enum: ["pending", "preparing", "ready", "completed", "cancelled"],

          },

          },

            },

          },

          },
        },
        required: ["order_id", "venue_id", "status", "total_amount"],
      },

          },

          },

          },
        },
        required: ["item_name", "quantity", "price"],
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
        required: ["item_id", "venue_id", "item_name", "price"],
      },

          },

          },

          },

          },

          },

          },
        },
        required: ["venue_id", "item_name", "price"],
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

            enum: ["table", "counter"],

          },

          },

            enum: ["small", "medium", "large"],

          },
        },
        required: ["venue_id", "type", "name"],
      },

          },

          },

            enum: ["table", "counter"],

          },

          },

          },
        },
        required: ["qr_id", "url", "type", "name"],
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
    {

    },
    {

    },
    {

    },
  ],
};

export default openApiSpec;
