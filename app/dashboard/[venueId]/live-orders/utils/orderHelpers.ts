import { Order } from "../types";

export const isCounterOrder = (order: Order) => {
  // Counter orders include both till orders and pickup orders (both use source: "counter")
  // The difference is payment method: till = pay_at_till, pickup = online
  return order.source === "counter";
};

export const groupOrdersByTable = (orders: Order[]) => {
  const tableGroups: { [tableNumber: number]: Order[] } = {
    /* Empty */
  };

  orders.forEach((order) => {
    const tableNum = order.table_number || 0;
    if (!tableGroups[tableNum]) {
      tableGroups[tableNum] = [];
    }
    tableGroups[tableNum].push(order);

  const filteredGroups: { [tableNumber: number]: Order[] } = {
    /* Empty */
  };

  Object.keys(tableGroups).forEach((tableNum) => {
    const orders = tableGroups[Number(tableNum)];

    if (orders.length === 1) {
      filteredGroups[Number(tableNum)] = orders;
      return;
    }

    orders.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateA.getTime() - dateB.getTime();

    const shouldGroup = orders.every((order, index) => {
      if (index === 0) return true;

      const prevOrder = orders[index - 1];
      const timeDiff =
        new Date(order.created_at).getTime() - new Date(prevOrder.created_at).getTime();
      const timeDiffMinutes = timeDiff / (1000 * 60);

      const sameCustomer = order.customer_name === prevOrder.customer_name;
      const withinTimeWindow = timeDiffMinutes <= 30;

      return sameCustomer && withinTimeWindow;

    if (shouldGroup) {
      filteredGroups[Number(tableNum)] = orders;
    }

  return filteredGroups;
};

export const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString("en-GB", {

};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-GB", {

};

export const getShortOrderNumber = (orderId: string) => {
  return orderId.slice(-6).toUpperCase();
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case "PLACED":
      return "bg-yellow-100 text-yellow-800";
    case "IN_PREP":
      return "bg-blue-100 text-blue-800";
    case "READY":
      return "bg-green-100 text-green-800";
    case "COMPLETED":
      return "bg-green-100 text-green-800";
    case "MIXED":
      return "bg-purple-100 text-purple-800";
    case "MIXED_READY":
      return "bg-emerald-100 text-emerald-800";
    case "MIXED_PREP":
      return "bg-indigo-100 text-indigo-800";

  }
};

export const getPaymentStatusColor = (paymentStatus: string) => {
  switch (paymentStatus) {
    case "PAID":
      return "bg-green-100 text-green-800";
    case "UNPAID":
      return "bg-red-100 text-red-800";
    case "PAY_LATER":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-800";
    case "REFUNDED":
      return "bg-red-100 text-red-800";
    case "MIXED":
      return "bg-amber-100 text-amber-800";

  }
};
