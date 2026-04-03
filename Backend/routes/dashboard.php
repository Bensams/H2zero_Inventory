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

if ($action === 'stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $filterDate = trim($_GET['date'] ?? '');

        if ($filterDate === '') {
            $filterDate = date('Y-m-d');
        }

        // =========================
        // INVENTORY = EXACT DATE
        // =========================
        $inventoryStmt = $db->prepare("
            SELECT 
                COUNT(DISTINCT item_name) AS total_products,
                COALESCE(SUM(quantity), 0) AS total_quantity
            FROM inventory
            WHERE DATE(date_added) = :filter_date
        ");
        $inventoryStmt->execute([
            ':filter_date' => $filterDate
        ]);
        $inventoryStats = $inventoryStmt->fetch(PDO::FETCH_ASSOC);

        $inventoryRowsStmt = $db->prepare("
            SELECT item_name, category, quantity
            FROM inventory
            WHERE DATE(date_added) = :filter_date
        ");
        $inventoryRowsStmt->execute([
            ':filter_date' => $filterDate
        ]);
        $inventoryRows = $inventoryRowsStmt->fetchAll(PDO::FETCH_ASSOC);

        $totalML = 0;
        foreach ($inventoryRows as $row) {
            preg_match('/^(\d+)/', (string)$row['category'], $matches);
            $sizeMl = isset($matches[1]) ? (int)$matches[1] : 0;
            $qty = (int)($row['quantity'] ?? 0);
            $totalML += ($sizeMl * $qty);
        }

        // =========================
        // STOCKS = CUMULATIVE UP TO SELECTED DATE
        // FROM stock_logs
        // =========================

        // Distinct products up to selected date
        $stockProductsStmt = $db->prepare("
            SELECT COUNT(DISTINCT product_name) AS stock_total_products
            FROM stock_logs
            WHERE DATE(created_at) <= :filter_date
        ");
        $stockProductsStmt->execute([
            ':filter_date' => $filterDate
        ]);
        $stockProductsRow = $stockProductsStmt->fetch(PDO::FETCH_ASSOC);

        // Total quantity up to selected date
        $stockQtyStmt = $db->prepare("
            SELECT COALESCE(SUM(quantity), 0) AS stock_total_quantity
            FROM stock_logs
            WHERE DATE(created_at) <= :filter_date
        ");
        $stockQtyStmt->execute([
            ':filter_date' => $filterDate
        ]);
        $stockQtyRow = $stockQtyStmt->fetch(PDO::FETCH_ASSOC);

        // Total ML up to selected date
        $stockRowsStmt = $db->prepare("
            SELECT product_name, size_label, quantity
            FROM stock_logs
            WHERE DATE(created_at) <= :filter_date
        ");
        $stockRowsStmt->execute([
            ':filter_date' => $filterDate
        ]);
        $stockRows = $stockRowsStmt->fetchAll(PDO::FETCH_ASSOC);

        $stockTotalML = 0;
        foreach ($stockRows as $row) {
            preg_match('/^(\d+)/', (string)$row['size_label'], $matches);
            $sizeMl = isset($matches[1]) ? (int)$matches[1] : 0;
            $qty = (int)($row['quantity'] ?? 0);
            $stockTotalML += ($sizeMl * $qty);
        }

        // Per-product cumulative totals up to selected date
        $stocksOverviewStmt = $db->prepare("
            SELECT 
                product_name,
                COALESCE(SUM(quantity), 0) AS total_quantity
            FROM stock_logs
            WHERE DATE(created_at) <= :filter_date
            GROUP BY product_name
            HAVING COALESCE(SUM(quantity), 0) > 0
            ORDER BY product_name ASC
        ");
        $stocksOverviewStmt->execute([
            ':filter_date' => $filterDate
        ]);
        $stocksOverview = $stocksOverviewStmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse(true, "Dashboard stats fetched.", [
            'date' => $filterDate,

            // inventory exact date
            'total_products' => (int)($inventoryStats['total_products'] ?? 0),
            'total_quantity' => (int)($inventoryStats['total_quantity'] ?? 0),
            'total_ml' => (int)$totalML,

            // stocks cumulative to selected date
            'stock_total_products' => (int)($stockProductsRow['stock_total_products'] ?? 0),
            'stock_total_quantity' => (int)($stockQtyRow['stock_total_quantity'] ?? 0),
            'stock_total_ml' => (int)$stockTotalML,
            'stocks_overview' => $stocksOverview
        ]);
    } catch (Throwable $e) {
        jsonResponse(false, "Failed to fetch dashboard stats.", $e->getMessage(), 500);
    }
}

jsonResponse(false, "Invalid dashboard route.", null, 404);