document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAdminPage();
  if (!user) return;

  setUserLabels(user);
  document.querySelectorAll(".logout-btn").forEach((btn) => {
    btn.addEventListener("click", handleLogout);
  });

  await loadAdminStocksOverview();
});

async function loadAdminStocksOverview() {
  const container = document.getElementById("adminStocksOverview");
  if (!container) return;

  try {
    const result = await apiRequest(API_ENDPOINTS.stocksList, {
      method: "GET"
    });

    if (!result.success || !Array.isArray(result.data) || !result.data.length) {
      container.innerHTML = `
        <div class="overview-card">
          <div class="overview-title">No Stocks</div>
          <div class="overview-item">No stock overview available.</div>
        </div>
      `;
      return;
    }

    renderStocksOverviewCards(container, result.data);
  } catch (error) {
    console.error("loadAdminStocksOverview error:", error);
    container.innerHTML = `
      <div class="overview-card">
        <div class="overview-title">Error</div>
        <div class="overview-item">Failed to load stocks overview.</div>
      </div>
    `;
  }
}

function renderStocksOverviewCards(container, rows) {
  const grouped = {};

  rows.forEach((row) => {
    const product = String(row.product_name || "Unknown").trim();
    const size = String(row.size_label || "").trim();
    const qty = Number(row.quantity || 0);

    if (qty <= 0) return;

    if (!grouped[product]) {
      grouped[product] = {
        total: 0,
        sizes: {}
      };
    }

    grouped[product].total += qty;
    grouped[product].sizes[size] = (grouped[product].sizes[size] || 0) + qty;
  });

  const products = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  if (!products.length) {
    container.innerHTML = `
      <div class="overview-card">
        <div class="overview-title">No Stocks</div>
        <div class="overview-item">No stock overview available.</div>
      </div>
    `;
    return;
  }

  const sizeOrder = ["350 ml", "500 ml", "1000 ml", "1500 ml", "4000 ml", "6000 ml"];

  container.innerHTML = products.map((product) => {
    const data = grouped[product];

    const sizeLines = sizeOrder
      .filter((size) => Number(data.sizes[size] || 0) > 0)
      .map((size) => `
        <div class="overview-item">${escapeHtml(size)} - ${Number(data.sizes[size]).toLocaleString()}</div>
      `)
      .join("");

    return `
      <div class="overview-card">
        <div class="overview-title">${escapeHtml(product)}</div>
        <div class="overview-total">Total Quantity: ${Number(data.total).toLocaleString()}</div>
        ${sizeLines}
      </div>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}