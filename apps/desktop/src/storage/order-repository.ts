import type { Order } from "../domain/order";
const ordersKey = "@nexus/desktop/orders";
export function listOrders(): Order[] { try { return JSON.parse(window.localStorage.getItem(ordersKey) ?? "[]") as Order[]; } catch { return []; } }
export function saveOrder(order: Order): Order[] { const orders = [order, ...listOrders()]; window.localStorage.setItem(ordersKey, JSON.stringify(orders)); return orders; }
