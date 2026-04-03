// =====================
// Inventory Matrix CRUD
// =====================

const INV_KEY = "h2zero_inventory_matrix_v2";
const SIZES = [350, 500, 1000, 1500, 4000, 6000];

const matrixBody = document.getElementById("matrixBody");
const btnSave = document.getElementById("btnSave");
const btnAddBrand = document.getElementById("btnAddBrand");
const saveMsg = document.getElementById("saveMsg");
const logoutTop = document.getElementById("logoutBtnTop");

function toast(title, body, type = "") {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="t-title">${title}</div><div class="t-body">${body || ""}</div>`;
  host.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function makeSizeMap(value) {
  const obj = {};
  SIZES.forEach(s => obj[s] = value);
  return obj;
}

function defaultInventory() {
  return [
    { id: crypto.randomUUID(), brand: "H2zero", sizes: makeSizeMap(0) },
    { id: crypto.randomUUID(), brand: "Coolers", sizes: makeSizeMap(0) },
  ];
}

function loadInventory() {
  const raw = localStorage.getItem(INV_KEY);
  if (!raw) return defaultInventory();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultInventory();
    return parsed;
  } catch {
    return defaultInventory();
  }
}

function saveInventory(data) {
  localStorage.setItem(INV_KEY, JSON.stringify(data));
}

function renderMatrix(data) {
  matrixBody.innerHTML = "";

  data.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    // Brand cell (editable input)
    const tdBrand = document.createElement("td");
    const brandInput = document.createElement("input");
    brandInput.className = "brand-input";
    brandInput.value = row.brand ?? "";
    brandInput.placeholder = "Product name...";
    brandInput.dataset.row = String(rowIndex);
    brandInput.dataset.kind = "brand";
    tdBrand.appendChild(brandInput);
    tr.appendChild(tdBrand);

    // Size inputs
    SIZES.forEach((size) => {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.className = "qty-input";
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = row.sizes?.[size] ?? 0;
      input.dataset.row = String(rowIndex);
      input.dataset.size = String(size);
      input.dataset.kind = "qty";
      td.appendChild(input);
      tr.appendChild(td);
    });

    // Action cell (delete)
    const tdAction = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "danger-btn";
    delBtn.textContent = "Delete";
    delBtn.dataset.action = "delete";
    delBtn.dataset.row = String(rowIndex);
    tdAction.appendChild(delBtn);
    tr.appendChild(tdAction);

    matrixBody.appendChild(tr);
  });
}

function readFromInputs(currentData) {
  const data = JSON.parse(JSON.stringify(currentData));

  // brand inputs
  const brandInputs = matrixBody.querySelectorAll('input[data-kind="brand"]');
  brandInputs.forEach(inp => {
    const row = Number(inp.dataset.row);
    data[row].brand = (inp.value || "").trim();
  });

  // qty inputs
  const qtyInputs = matrixBody.querySelectorAll('input[data-kind="qty"]');
  qtyInputs.forEach(inp => {
    const row = Number(inp.dataset.row);
    const size = Number(inp.dataset.size);
    const val = Number(inp.value || 0);
    if (!Number.isFinite(val) || val < 0) return;
    data[row].sizes[size] = Math.floor(val);
  });

  return data;
}

let inventory = loadInventory();
renderMatrix(inventory);

// Add product row
btnAddBrand.addEventListener("click", () => {
  inventory = readFromInputs(inventory);

  inventory.push({
    id: crypto.randomUUID(),
    brand: "New Product",
    sizes: makeSizeMap(0)
  });

  renderMatrix(inventory);
  saveMsg.textContent = "New row added. Edit name/qty then Save.";
  toast("Added", "New product row added.", "ok");
});

// Delete row
matrixBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.action === "delete") {
    const rowIndex = Number(btn.dataset.row);

    const name = inventory[rowIndex]?.brand || "this product";
    const ok = confirm(`Delete "${name}"?`);
    if (!ok) return;

    inventory = readFromInputs(inventory);
    inventory.splice(rowIndex, 1);
    renderMatrix(inventory);

    saveMsg.textContent = "Row deleted. Click Save to apply.";
    toast("Deleted", "Product row removed.", "ok");
  }
});

// Save
btnSave.addEventListener("click", () => {
  inventory = readFromInputs(inventory);

  // basic validation: no empty names
  const bad = inventory.find(r => !String(r.brand || "").trim());
  if (bad) {
    toast("Error", "Product name cannot be empty.", "err");
    return;
  }

  saveInventory(inventory);
  saveMsg.textContent = "Saved ✅ Dashboard will update.";
  toast("Saved", "Inventory matrix saved.", "ok");
});

// Top logout
logoutTop?.addEventListener("click", () => {
  localStorage.removeItem("h2zero_auth");
  window.location.href = "index.html";
});