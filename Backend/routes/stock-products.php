<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user'])) {
    jsonResponse(false, "Unauthorized.", null, 401);
}

$db = (new Database())->connect();
$action = $_GET['action'] ?? '';
$user = $_SESSION['user'];

function getStockProductRequestData(): array {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->query("
        SELECT sp.id, sp.product_name, sp.created_by, sp.created_at
        FROM stock_products sp
        ORDER BY sp.product_name ASC
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Stock products fetched.", $rows);
}

if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getStockProductRequestData();
    $product_name = trim($data['product_name'] ?? '');

    if ($product_name === '') {
        jsonResponse(false, "Product name is required.", null, 422);
    }

    $check = $db->prepare("
        SELECT id
        FROM stock_products
        WHERE LOWER(product_name) = LOWER(:product_name)
        LIMIT 1
    ");
    $check->execute([
        ':product_name' => $product_name
    ]);

    if ($check->fetch()) {
        jsonResponse(false, "Product already exists.", null, 409);
    }

    $stmt = $db->prepare("
        INSERT INTO stock_products (
            product_name,
            created_by,
            created_at
        )
        VALUES (
            :product_name,
            :created_by,
            NOW()
        )
    ");

    $saved = $stmt->execute([
        ':product_name' => $product_name,
        ':created_by' => (int)$user['id']
    ]);

    if (!$saved) {
        jsonResponse(false, "Failed to add product.", null, 500);
    }

    jsonResponse(true, "Product added successfully.");
}

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(false, "Invalid product ID.", null, 422);
    }

    $stmt = $db->prepare("DELETE FROM stock_products WHERE id = :id");
    $deleted = $stmt->execute([
        ':id' => $id
    ]);

    if (!$deleted) {
        jsonResponse(false, "Failed to delete product.", null, 500);
    }

    jsonResponse(true, "Product deleted successfully.");
}

jsonResponse(false, "Invalid stock-products route.", null, 404);