let inventoryRows = [];
let groupedInventoryRows = [];
let inventoryPage = 0;
const rowsPerPage = 5;

let editingRow = null;
let deletingIds = [];

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireStaffPage();
  if (!user) return;

  setUserLabels(user);
  document.querySelectorAll(".logout-btn").forEach((btn) => btn.addEventListener("click", handleLogout));

  const dateInput = document.getElementById("reportDate");
  const dateText = document.getElementById("reportDateText");

  if (dateInput) {
    dateInput.value = getTodayDate();
    updateDateText(dateInput.value, dateText);
    dateInput.addEventListener("change", async () => {
      updateDateText(dateInput.value, dateText);
      await loadInventoryReport();
    });
  }

  document.getElementById("prevInventoryBtn")?.addEventListener("click", prevInventoryPage);
  document.getElementById("nextInventoryBtn")?.addEventListener("click", nextInventoryPage);

  bindReportModals();
  bindMessageModal();

  await loadInventoryReport();
});

function bindReportModals() {
  document.getElementById("closeEditRecordModal")?.addEventListener("click", closeEditRecordModal);
  document.getElementById("cancelEditRecordModal")?.addEventListener("click", closeEditRecordModal);
  document.getElementById("saveEditRecordModal")?.addEventListener("click", saveEditedRecord);
  document.getElementById("closeDeleteRecordModal")?.addEventListener("click", closeDeleteRecordModal);
  document.getElementById("cancelDeleteRecordModal")?.addEventListener("click", closeDeleteRecordModal);
  document.getElementById("confirmDeleteRecordModal")?.addEventListener("click", confirmDeleteRecordModal);
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

function getTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLong(dateString) {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, month, day);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function updateDateText(dateValue, targetElement) {
  if (!targetElement) return;
  targetElement.textContent = formatDateLong(dateValue);
}

function getSelectedReportDate() {
  const input = document.getElementById("reportDate");
  return input && input.value ? input.value : getTodayDate();
}

async function loadInventoryReport() {
  try {
    const selectedDate = getSelectedReportDate();
    const result = await apiRequest(`${API_ENDPOINTS.mineInventory}&date=${encodeURIComponent(selectedDate)}`, { method: "GET" });

    if (!result.success || !Array.isArray(result.data)) {
      inventoryRows = [];
      groupedInventoryRows = [];
      inventoryPage = 0;
      renderInventoryTable();
      return;
    }

    inventoryRows = result.data;
    groupedInventoryRows = groupInventoryRows(inventoryRows);
    inventoryPage = 0;
    renderInventoryTable();
  } catch (error) {
    console.error("loadInventoryReport error:", error);
    inventoryRows = [];
    groupedInventoryRows = [];
    inventoryPage = 0;
    renderInventoryTable();
  }
}

function normalizeTimestampToMinute(dateValue) {
  const value = String(dateValue || "").trim();
  return value ? value.slice(0, 16) : "";
}

function extractMlNumber(categoryValue) {
  const match = String(categoryValue || "").match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function groupInventoryRows(rows) {
  const groupedMap = new Map();

  rows.forEach((row) => {
    const addedBy = String(row.added_by_name || "-").trim();
    const product = String(row.item_name || "-").trim();
    const timestamp = String(row.date_added || "").trim();
    const minuteKey = normalizeTimestampToMinute(timestamp);
    const groupKey = `${addedBy}__${product}__${minuteKey}`;

    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        added_by_name: addedBy,
        item_name: product,
        date_added: timestamp,
        sizes: { "350 ml": 0, "500 ml": 0, "1000 ml": 0, "1500 ml": 0, "4000 ml": 0, "6000 ml": 0 },
        total_ml: 0,
        ids: {}
      });
    }

    const entry = groupedMap.get(groupKey);
    const category = String(row.category || "").trim();
    const qty = parseInt(row.quantity, 10) || 0;
    const ml = extractMlNumber(category);

    if (entry.sizes[category] !== undefined) {
      entry.sizes[category] += qty;
      entry.ids[category] = row.id;
    }

    entry.total_ml += qty * ml;
    if (timestamp > entry.date_added) entry.date_added = timestamp;
  });

  return Array.from(groupedMap.values()).sort((a, b) => String(b.date_added || "").localeCompare(String(a.date_added || "")));
}

function renderInventoryTable() {
  const tbody = document.getElementById("inventoryReportTableBody");
  const label = document.getElementById("inventoryPageLabel");
  const prevBtn = document.getElementById("prevInventoryBtn");
  const nextBtn = document.getElementById("nextInventoryBtn");

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!groupedInventoryRows.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:#b8c5d9;">No inventory records found.</td></tr>`;
    if (label) label.textContent = "Page 0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const start = inventoryPage * rowsPerPage;
  const items = groupedInventoryRows.slice(start, start + rowsPerPage);

  items.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.added_by_name ?? "-")}</td>
      <td>${escapeHtml(row.item_name ?? "-")}</td>
      <td>${Number(row.sizes["350 ml"] || 0).toLocaleString()}</td>
      <td>${Number(row.sizes["500 ml"] || 0).toLocaleString()}</td>
      <td>${Number(row.sizes["1000 ml"] || 0).toLocaleString()}</td>
      <td>${Number(row.sizes["1500 ml"] || 0).toLocaleString()}</td>
      <td>${Number(row.sizes["4000 ml"] || 0).toLocaleString()}</td>
      <td>${Number(row.sizes["6000 ml"] || 0).toLocaleString()}</td>
      <td>${Number(row.total_ml || 0).toLocaleString()}</td>
      <td>${escapeHtml(row.date_added ?? "-")}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-primary btn-update" type="button">Update</button>
          <button class="btn btn-danger btn-delete" type="button">Delete</button>
        </div>
      </td>
    `;

    tr.querySelector(".btn-update").addEventListener("click", () => openEditRecordModal(row));
    tr.querySelector(".btn-delete").addEventListener("click", () => openDeleteRecordModal(row));
    tbody.appendChild(tr);
  });

  const totalPages = Math.ceil(groupedInventoryRows.length / rowsPerPage);
  if (label) label.textContent = `Page ${inventoryPage + 1} of ${totalPages}`;
  if (prevBtn) prevBtn.disabled = inventoryPage === 0;
  if (nextBtn) nextBtn.disabled = inventoryPage >= totalPages - 1;
}

function openEditRecordModal(row) {
  editingRow = row;
  document.getElementById("editRecordProduct").value = row.item_name || "";
  document.getElementById("edit350").value = row.sizes["350 ml"] || 0;
  document.getElementById("edit500").value = row.sizes["500 ml"] || 0;
  document.getElementById("edit1000").value = row.sizes["1000 ml"] || 0;
  document.getElementById("edit1500").value = row.sizes["1500 ml"] || 0;
  document.getElementById("edit4000").value = row.sizes["4000 ml"] || 0;
  document.getElementById("edit6000").value = row.sizes["6000 ml"] || 0;
  const modal = document.getElementById("editRecordModal");
  if (modal) modal.style.display = "flex";
}

function closeEditRecordModal() {
  const modal = document.getElementById("editRecordModal");
  if (modal) modal.style.display = "none";
  editingRow = null;
}

async function saveEditedRecord() {
  if (!editingRow) return;

  const product = document.getElementById("editRecordProduct").value.trim();
  const values = {
    "350 ml": parseInt(document.getElementById("edit350").value || "0", 10),
    "500 ml": parseInt(document.getElementById("edit500").value || "0", 10),
    "1000 ml": parseInt(document.getElementById("edit1000").value || "0", 10),
    "1500 ml": parseInt(document.getElementById("edit1500").value || "0", 10),
    "4000 ml": parseInt(document.getElementById("edit4000").value || "0", 10),
    "6000 ml": parseInt(document.getElementById("edit6000").value || "0", 10)
  };

  try {
    for (const [size, qty] of Object.entries(values)) {
      if (editingRow.ids[size]) {
        const result = await apiRequest(API_ENDPOINTS.inventoryUpdate, {
          method: "PUT",
          body: JSON.stringify({
            id: editingRow.ids[size],
            item_name: product,
            category: size,
            quantity: qty,
            unit: "pcs"
          })
        });

        if (!result.success) {
          showMessageModal(result.message || "Failed to update record.");
          return;
        }
      }
    }

    closeEditRecordModal();
    await loadInventoryReport();
    showMessageModal("Inventory record updated successfully.", "Success");
  } catch (error) {
    console.error("saveEditedRecord error:", error);
    showMessageModal("Failed to update record.");
  }
}

function openDeleteRecordModal(row) {
  deletingIds = Object.values(row.ids || {});
  const modal = document.getElementById("deleteRecordModal");
  const text = document.getElementById("deleteRecordText");
  if (text) text.textContent = `Delete inventory record for "${row.item_name}" dated "${row.date_added}"?`;
  if (modal) modal.style.display = "flex";
}

function closeDeleteRecordModal() {
  const modal = document.getElementById("deleteRecordModal");
  if (modal) modal.style.display = "none";
  deletingIds = [];
}

async function confirmDeleteRecordModal() {
  if (!deletingIds.length) return;

  try {
    for (const id of deletingIds) {
      const result = await apiRequest(API_ENDPOINTS.inventoryDelete(id), { method: "DELETE" });
      if (!result.success) {
        showMessageModal(result.message || "Failed to delete record.");
        return;
      }
    }

    closeDeleteRecordModal();
    await loadInventoryReport();
    showMessageModal("Inventory record deleted successfully.", "Success");
  } catch (error) {
    console.error("confirmDeleteRecordModal error:", error);
    showMessageModal("Failed to delete record.");
  }
}

function nextInventoryPage() {
  const totalPages = Math.ceil(groupedInventoryRows.length / rowsPerPage);
  if (inventoryPage < totalPages - 1) {
    inventoryPage++;
    renderInventoryTable();
  }
}

function prevInventoryPage() {
  if (inventoryPage > 0) {
    inventoryPage--;
    renderInventoryTable();
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