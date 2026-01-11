export interface Order {

  }>;

  table?: { is_configured: boolean } | null;
}

export interface LiveOrdersClientProps {

}

export interface GroupedHistoryOrders {
  [date: string]: Order[];
}
