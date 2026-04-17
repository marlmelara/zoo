import api from '../lib/api';

export const getInventoryItems = ()          => api.get('/inventory');
export const getInventoryItem  = (id)        => api.get(`/inventory/${id}`);
export const createInventoryItem = (body)    => api.post('/inventory', body);
export const updateInventoryItem = (id, b)   => api.patch(`/inventory/${id}`, b);
export const getLowStockItems  = ()          => api.get('/inventory/low-stock');
export const getShops          = ()          => api.get('/inventory/shops/all');

export async function getShopItems(outletId) {
    const items = await api.get('/inventory');
    return items.filter(i => i.outlet_id === outletId && i.stock_count > 0);
}

export async function decrementStock(itemId, quantity) {
    return api.post(`/inventory/${itemId}/decrement`, { quantity });
}
