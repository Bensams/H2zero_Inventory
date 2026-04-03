let stockProducts = [];

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdminPage();
  if (!user) return;

  setUserLabels(user);

  document.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });

  document.getElementById("addProductBtn")?.addEventListener("click", addInventoryRow);
  document.getElementById("saveInventoryBtn")?.addEventListener("click", saveInventoryRows);

  document.getElementById("closeMessageModal")?.addEventListener("click", closeMessageModal);
  document.getElementById("okMessageModal")?.addEventListener("click", closeMessageModal);

  await loadStockProducts();
  addInventoryRow();
});

async function loadStockProducts() {
  try {
    const result = await apiRequest(API_ENDPOINTS.stockProductsList, {
      method: "GET"
    });

    if (!result.success || !Array.isArray(result.data)) {
      stockProducts = [];
      return;
    }

    stockProducts = result.data;
  } catch (error) {
    console.error("loadStockProducts error:", error);
    stockProducts = [];
  }
}

function addInventoryRow() {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;

  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>
      <select class="table-input product-select">
        <option value="">Select product</option>
        ${stockProducts.map((row) => `
          <option value="${escapeHtmlAttr(row.product_name)}">${escapeHtml(row.product_name)}</option>
        `).join("")}
      </select>
    </td>
    <td><input class="table-input qty-input" data-size="350 ml" type="number" min="0" value="0"></td>
    <td><input class="table-input qty-input" data-size="500 ml" type="number" min="0" value="0"></td>
    <td><input class="table-input qty-input" data-size="1000 ml" type="number" min="0" value="0"></td>
    <td><input class="table-input qty-input" data-size="1500 ml" type="number" min="0" value="0"></td>
    <td><input class="table-input qty-input" data-size="4000 ml" type="number" min="0" value="0"></td>
    <td><input class="table-input qty-input" data-size="6000 ml" type="number" min="0" value="0"></td>
    <td>
      <button class="btn btn-danger remove-row-btn" type="button">Remove</button>
    </td>
  `;

  tr.querySelector(".remove-row-btn").addEventListener("click", () => tr.remove());

  const productSelect = tr.querySelector(".product-select");
  const qtyInputs = tr.querySelectorAll(".qty-input");

  productSelect.addEventListener("change", async () => {
    const productName = productSelect.value.trim();
    await applyStockLimitsToRow(tr, productName);
  });

  qtyInputs.forEach((input) => {
    input.addEventListener("input", () => validateRowQuantities(tr));
  });

  tbody.appendChild(tr);
}

async function applyStockLimitsToRow(tr, productName) {
  const qtyInputs = tr.querySelectorAll(".qty-input");

  qtyInputs.forEach((input) => {
    input.value = "0";
    input.removeAttribute("max");
    input.placeholder = "";
    input.dataset.available = "0";
  });

  if (!productName) return;

  try {
    const result = await apiRequest(
      `${API_ENDPOINTS.stocksSizes}&product_name=${encodeURIComponent(productName)}`,
      { method: "GET" }
    );

    if (!result.success || !Array.isArray(result.data)) return;

    const stockMap = {};
    result.data.forEach((row) => {
      stockMap[row.size_label] = Number(row.quantity) || 0;
    });

    qtyInputs.forEach((input) => {
      const size = input.dataset.size;
      const available = stockMap[size] ?? 0;

      input.dataset.available = String(available);
      input.max = String(available);
      input.placeholder = `Max ${available}`;

      if (available === 0) {
        input.value = "0";
      }
    });
  } catch (error) {
    console.error("applyStockLimitsToRow error:", error);
  }
}

function validateRowQuantities(tr) {
  const qtyInputs = tr.querySelectorAll(".qty-input");

  for (const input of qtyInputs) {
    const qty = parseInt(input.value || "0", 10);
    const available = parseInt(input.dataset.available || "0", 10);

    if (qty > available) {
      input.setCustomValidity(`Insufficient stock. Available: ${available}`);
    } else {
      input.setCustomValidity("");
    }
  }
}

function hasAtLeastOneQuantity(tr) {
  const qtyInputs = Array.from(tr.querySelectorAll(".qty-input"));
  return qtyInputs.some((input) => (parseInt(input.value || "0", 10) || 0) > 0);
}

async function saveInventoryRows() {
  const rows = Array.from(document.querySelectorAll("#inventoryTableBody tr"));

  if (!rows.length) {
    showMessageModal("Please add at least one product row.");
    return;
  }

  for (const tr of rows) {
    const productName = tr.querySelector(".product-select")?.value.trim() || "";

    if (!productName) {
      showMessageModal("Please select a product for every row.");
      return;
    }

    if (!hasAtLeastOneQuantity(tr)) {
      showMessageModal(`Please enter at least one quantity for ${productName}.`);
      return;
    }

    const qtyInputs = Array.from(tr.querySelectorAll(".qty-input"));
    for (const input of qtyInputs) {
      const qty = parseInt(input.value || "0", 10);
      const available = parseInt(input.dataset.available || "0", 10);

      if (qty > available) {
        showMessageModal(`Insufficient stock for ${productName} - ${input.dataset.size}. Available: ${available}`);
        return;
      }
    }
  }

  try {
    for (const tr of rows) {
      const productName = tr.querySelector(".product-select")?.value.trim() || "";
      const qtyInputs = Array.from(tr.querySelectorAll(".qty-input"));

      for (const input of qtyInputs) {
        const qty = parseInt(input.value || "0", 10);
        const size = input.dataset.size;

        if (qty > 0) {
          const result = await apiRequest(API_ENDPOINTS.inventoryCreate, {
            method: "POST",
            body: JSON.stringify({
              item_name: productName,
              category: size,
              quantity: qty,
              unit: "pcs"
            })
          });

          if (!result.success) {
            showMessageModal(result.message || `Failed to save ${productName} - ${size}.`);
            return;
          }
        }
      }
    }

    document.getElementById("inventoryTableBody").innerHTML = "";
    await loadStockProducts();
    addInventoryRow();
    showMessageModal("Inventory saved successfully.", "Success");
  } catch (error) {
    console.error("saveInventoryRows error:", error);
    showMessageModal("Failed to save inventory.");
  }
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}