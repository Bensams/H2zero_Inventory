const API_BASE_URL = "http://localhost/inventory-system/index.php";

const API_ENDPOINTS = {
  login: `${API_BASE_URL}?route=auth&action=login`,
  logout: `${API_BASE_URL}?route=auth&action=logout`,
  me: `${API_BASE_URL}?route=auth&action=me`,

  registerStaff: `${API_BASE_URL}?route=auth&action=register`,
  staffList: `${API_BASE_URL}?route=auth&action=staff-list`,
  editStaff: `${API_BASE_URL}?route=auth&action=edit-staff`,
  deleteStaff: (id) => `${API_BASE_URL}?route=auth&action=delete-staff&id=${id}`,

  inventoryList: `${API_BASE_URL}?route=inventory&action=list`,
  mineInventory: `${API_BASE_URL}?route=inventory&action=mine`,
  inventoryCreate: `${API_BASE_URL}?route=inventory&action=create`,
  inventoryUpdate: `${API_BASE_URL}?route=inventory&action=update`,
  inventoryDelete: (id) => `${API_BASE_URL}?route=inventory&action=delete&id=${id}`,

  dashboardStats: `${API_BASE_URL}?route=dashboard&action=stats`,
  reportsInventory: `${API_BASE_URL}?route=reports&action=inventory`,
  reportsActivity: `${API_BASE_URL}?route=reports&action=activity`,

  stocksList: `${API_BASE_URL}?route=stocks&action=list`,
stocksOverview: `${API_BASE_URL}?route=stocks&action=overview`,
stocksCreate: `${API_BASE_URL}?route=stocks&action=create`,
stocksUpdate: `${API_BASE_URL}?route=stocks&action=update`,
stocksDelete: (id) => `${API_BASE_URL}?route=stocks&action=delete&id=${encodeURIComponent(id)}`,
stocksProducts: `${API_BASE_URL}?route=stocks&action=products`,
stocksSizes: `${API_BASE_URL}?route=stocks&action=sizes`,
stocksTodayLogs: `${API_BASE_URL}?route=stocks&action=today-logs`,

  stockProductsList: `${API_BASE_URL}?route=stock-products&action=list`,
stockProductsCreate: `${API_BASE_URL}?route=stock-products&action=create`,
stockProductsDelete: (id) => `${API_BASE_URL}?route=stock-products&action=delete&id=${encodeURIComponent(id)}`,

resetStaffPassword: `${API_BASE_URL}?route=auth&action=reset-staff-password`,
};