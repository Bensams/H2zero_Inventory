let stocksRows = [];
let currentStocksPage = 0;
const stocksPerPage = 5;

let selectedProductToRemove = null;
let selectedStockRow = null;
let pendingDeleteStockId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdminPage();
  if (!user) return;

  setUserLabels(user);

  document.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });

  document.getElementById("saveStockBtn")?.addEventListener("click", saveStock);
  document.getElementById("prevStocksBtn")?.addEventListener("click", prevStocksPage);
  document.getElementById("nextStocksBtn")?.addEventListener("click", nextStocksPage);

  document.getElementById("addProductOptionBtn")?.addEventListener("click", openAddProductModal);
  document.getElementById("removeProductOptionBtn")?.addEventListener("click", openRemoveProductModal);

  bindProductModals();
  bindStockRowModals();
  bindMessageModal();

  await loadProductDropdown();
  await loadStocks();
});

function bindProductModals() {
  document.getElementById("closeProductModal")?.addEventListener("click", closeAddProductModal);
  document.getElementById("cancelProductModal")?.addEventListener("click", closeAddProductModal);
  document.getElementById("saveProductModal")?.addEventListener("click", saveProductFromModal);

  document.getElementById("closeRemoveProductModal")?.addEventListener("click", closeRemoveProductModal);
  document.getElementById("cancelRemoveProductModal")?.addEventListener("click", closeRemoveProductModal);
  document.getElementById("confirmRemoveProductModal")?.addEventListener("click", confirmRemoveProductModal);
}

function bindStockRowModals() {
  document.getElementById("closeEditStockModal")?.addEventListener("click", closeEditStockModal);
  document.getElementById("cancelEditStockModal")?.addEventListener("click", closeEditStockModal);
  document.getElementById("saveEditStockModal")?.addEventListener("click", saveEditedStockRow);

  document.getElementById("closeDeleteStockModal")?.addEventListener("click", closeDeleteStockModal);
  document.getElementById("cancelDeleteStockModal")?.addEventListener("click", closeDeleteStockModal);
  document.getElementById("confirmDeleteStockModal")?.addEventListener("click", confirmDeleteStockModal);
}

function bindMessageModal() {
  document.getElementById("closeMessageModal")?.addEventListener("click", closeMessageModal);
  document.getElementById("okMessageModal")?.addEventListener("click", closeMessageModal);
}

function showMessageModal(message, title = "Notice") {
  const modal = document.getElementById("messageModal");
  const titleEl = document.getElementById("messageModalTitle");
  const textEl = document.getElementById("messageModalText");

  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = message;
  if (modal) modal.style.display = "flex";
}

function closeMessageModal() {
  const modal = document.getElementById("messageModal");
  if (modal) modal.style.display = "none";
}

function openAddProductModal() {
  const modal = document.getElementById("productModal");
  const input = document.getElementById("newProductName");
  if (input) input.value = "";
  if (modal) modal.style.display = "flex";
}

function closeAddProductModal() {
  const modal = document.getElementById("productModal");
  if (modal) modal.style.display = "none";
}

async function saveProductFromModal() {
  const input = document.getElementById("newProductName");
  const name = (input?.value || "").trim();

  if (!name) {
    showMessageModal("Product name is required.");
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.stockProductsCreate, {
      method: "POST",
      body: JSON.stringify({ product_name: name })
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to add product.");
      return;
    }

    closeAddProductModal();
    await loadProductDropdown();
    document.getElementById("productName").value = name;
    showMessageModal("Product added successfully.", "Success");
  } catch (error) {
    console.error("saveProductFromModal error:", error);
    showMessageModal("Failed to add product.");
  }
}

function openRemoveProductModal() {
  const select = document.getElementById("productName");
  if (!select) return;

  const selectedOption = select.options[select.selectedIndex];
  const id = selectedOption?.dataset?.id;
  const name = selectedOption?.value || "";

  if (!id) {
    showMessageModal("Please select a product to remove.");
    return;
  }

  selectedProductToRemove = { id, name };

  const text = document.getElementById("removeProductText");
  if (text) text.textContent = `Are you sure you want to remove "${name}"?`;

  const modal = document.getElementById("removeProductModal");
  if (modal) modal.style.display = "flex";
}

function closeRemoveProductModal() {
  const modal = document.getElementById("removeProductModal");
  if (modal) modal.style.display = "none";
  selectedProductToRemove = null;
}

async function confirmRemoveProductModal() {
  if (!selectedProductToRemove) return;

  try {
    const result = await apiRequest(API_ENDPOINTS.stockProductsDelete(selectedProductToRemove.id), {
      method: "DELETE"
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to remove product.");
      return;
    }

    closeRemoveProductModal();
    await loadProductDropdown();
    showMessageModal("Product removed successfully.", "Success");
  } catch (error) {
    console.error("confirmRemoveProductModal error:", error);
    showMessageModal("Failed to remove product.");
  }
}

async function loadProductDropdown() {
  const select = document.getElementById("productName");
  if (!select) return;

  select.innerHTML = `<option value="">Select product</option>`;

  try {
    const result = await apiRequest(API_ENDPOINTS.stockProductsList, { method: "GET" });

    if (!result.success || !Array.isArray(result.data)) return;

    result.data.forEach((row) => {
      const option = document.createElement("option");
      option.value = row.product_name;
      option.textContent = row.product_name;
      option.dataset.id = row.id;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("loadProductDropdown error:", error);
  }
}

async function saveStock() {
  const product_name = document.getElementById("productName").value.trim();
  const size_label = document.getElementById("sizeLabel").value.trim();
  const quantity = parseInt(document.getElementById("stockQty").value || "0", 10);

  if (!product_name || !size_label || quantity <= 0) {
    showMessageModal("Please complete all stock fields.");
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.stocksCreate, {
      method: "POST",
      body: JSON.stringify({ product_name, size_label, quantity })
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to save stock.");
      return;
    }

    document.getElementById("stockQty").value = "";
    await loadStocks();
    showMessageModal("Stock saved successfully.", "Success");
  } catch (error) {
    console.error("saveStock error:", error);
    showMessageModal("Failed to save stock.");
  }
}

async function loadStocks() {
  try {
    const result = await apiRequest(API_ENDPOINTS.stocksTodayLogs, { method: "GET" });

    if (!result.success || !Array.isArray(result.data)) {
      stocksRows = [];
      renderStocksTable();
      return;
    }

    stocksRows = result.data;
    currentStocksPage = 0;
    renderStocksTable();
  } catch (error) {
    console.error("loadStocks error:", error);
    stocksRows = [];
    renderStocksTable();
  }
}

function renderStocksTable() {
  const tbody = document.getElementById("stocksTableBody");
  const pageLabel = document.getElementById("stocksPageLabel");
  const prevBtn = document.getElementById("prevStocksBtn");
  const nextBtn = document.getElementById("nextStocksBtn");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!stocksRows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#b8c5d9;">No stocks found for today.</td></tr>`;
    if (pageLabel) pageLabel.textContent = "Page 0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const start = currentStocksPage * stocksPerPage;
  const pageItems = stocksRows.slice(start, start + stocksPerPage);

  pageItems.forEach((row) => {
    const qty = Number(row.quantity) || 0;

    let statusClass = "status-ok";
    let statusText = "In Stock";

    if (qty === 0) {
      statusClass = "status-out";
      statusText = "Out of Stock";
    } else if (qty <= 10) {
      statusClass = "status-low";
      statusText = "Low Stock";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.product_name)}</td>
      <td>${escapeHtml(row.size_label)}</td>
      <td>${qty.toLocaleString()}</td>
      <td class="${statusClass}">${statusText}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-primary btn-edit-stock" type="button">Edit</button>
          <button class="btn btn-danger btn-delete-stock" type="button">Delete</button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-edit-stock").addEventListener("click", () => openEditStockModal(row));
    tr.querySelector(".btn-delete-stock").addEventListener("click", () => openDeleteStockModal(row.id, row.product_name, row.size_label));

    tbody.appendChild(tr);
  });

  const totalPages = Math.ceil(stocksRows.length / stocksPerPage);
  if (pageLabel) pageLabel.textContent = `Page ${currentStocksPage + 1} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = currentStocksPage === 0;
  if (nextBtn) nextBtn.disabled = currentStocksPage >= totalPages - 1;
}

function openEditStockModal(row) {
  selectedStockRow = row;

  document.getElementById("editStockProduct").value = row.product_name || "";
  document.getElementById("editStockSize").value = row.size_label || "";
  document.getElementById("editStockQuantity").value = row.quantity || 0;

  const modal = document.getElementById("editStockModal");
  if (modal) modal.style.display = "flex";
}

function closeEditStockModal() {
  const modal = document.getElementById("editStockModal");
  if (modal) modal.style.display = "none";
  selectedStockRow = null;
}

async function saveEditedStockRow() {
  if (!selectedStockRow) return;

  const qtyValue = parseInt(document.getElementById("editStockQuantity")?.value || "0", 10);

  if (isNaN(qtyValue) || qtyValue < 0) {
    showMessageModal("Invalid quantity.");
    return;
  }

  try {
    const result = await apiRequest(API_ENDPOINTS.stocksUpdate, {
      method: "PUT",
      body: JSON.stringify({
        id: selectedStockRow.id,
        product_name: selectedStockRow.product_name,
        size_label: selectedStockRow.size_label,
        quantity: qtyValue
      })
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to update stock.");
      return;
    }

    closeEditStockModal();
    await loadStocks();
    showMessageModal("Stock updated successfully.", "Success");
  } catch (error) {
    console.error("saveEditedStockRow error:", error);
    showMessageModal("Failed to update stock.");
  }
}

function openDeleteStockModal(id, product, size) {
  pendingDeleteStockId = id;
  const text = document.getElementById("deleteStockText");
  const modal = document.getElementById("deleteStockModal");

  if (text) text.textContent = `Delete ${product} (${size})?`;
  if (modal) modal.style.display = "flex";
}

function closeDeleteStockModal() {
  const modal = document.getElementById("deleteStockModal");
  if (modal) modal.style.display = "none";
  pendingDeleteStockId = null;
}

async function confirmDeleteStockModal() {
  if (!pendingDeleteStockId) return;

  try {
    const result = await apiRequest(API_ENDPOINTS.stocksDelete(pendingDeleteStockId), {
      method: "DELETE"
    });

    if (!result.success) {
      showMessageModal(result.message || "Failed to delete stock.");
      return;
    }

    closeDeleteStockModal();
    await loadStocks();
    showMessageModal("Stock deleted successfully.", "Success");
  } catch (error) {
    console.error("confirmDeleteStockModal error:", error);
    showMessageModal("Failed to delete stock.");
  }
}

function nextStocksPage() {
  const totalPages = Math.ceil(stocksRows.length / stocksPerPage);
  if (currentStocksPage < totalPages - 1) {
    currentStocksPage++;
    renderStocksTable();
  }
}

function prevStocksPage() {
  if (currentStocksPage > 0) {
    currentStocksPage--;
    renderStocksTable();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}