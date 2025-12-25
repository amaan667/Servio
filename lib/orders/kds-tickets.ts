/**
 * Creates KDS tickets for an order
 *
 * This is a re-export of the unified category/keyword-based implementation.
 * Station assignment uses: category mapping → keyword matching → default station.
 */
export { createKDSTicketsWithAI as createKDSTickets } from "./kds-tickets-unified";
