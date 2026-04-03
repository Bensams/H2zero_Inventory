<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../models/ActivityLog.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!isset($_SESSION['user'])) {
    jsonResponse(false, "Unauthorized.", null, 401);
}

$db = (new Database())->connect();
$activityLog = new ActivityLog($db);
$user = $_SESSION['user'];
$action = $_GET['action'] ?? '';

function getStocksRequestData(): array {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function getTodayManilaDate(): string {
    return (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');
}

if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getStocksRequestData();

    $product_name = trim($data['product_name'] ?? '');
    $size_label = trim($data['size_label'] ?? '');
    $quantity = (int)($data['quantity'] ?? 0);

    if ($product_name === '' || $size_label === '' || $quantity <= 0) {
        jsonResponse(false, "Product, size, and quantity are required.", null, 422);
    }

    try {
        $db->beginTransaction();

        $findStmt = $db->prepare("
            SELECT id, quantity
            FROM stocks
            WHERE product_name = :product_name
              AND size_label = :size_label
            LIMIT 1
        ");
        $findStmt->execute([
            ':product_name' => $product_name,
            ':size_label' => $size_label
        ]);
        $existing = $findStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $newQty = ((int)$existing['quantity']) + $quantity;

            $updateStmt = $db->prepare("
                UPDATE stocks
                SET quantity = :quantity,
                    updated_at = NOW()
                WHERE id = :id
            ");
            $saved = $updateStmt->execute([
                ':quantity' => $newQty,
                ':id' => $existing['id']
            ]);
        } else {
            $insertStmt = $db->prepare("
                INSERT INTO stocks (
                    product_name,
                    size_label,
                    quantity,
                    created_by,
                    created_at,
                    updated_at
                )
                VALUES (
                    :product_name,
                    :size_label,
                    :quantity,
                    :created_by,
                    NOW(),
                    NOW()
                )
            ");
            $saved = $insertStmt->execute([
                ':product_name' => $product_name,
                ':size_label' => $size_label,
                ':quantity' => $quantity,
                ':created_by' => $user['id']
            ]);
        }

        if (!$saved) {
            $db->rollBack();
            jsonResponse(false, "Failed to save stock.", null, 500);
        }

        $logStmt = $db->prepare("
            INSERT INTO stock_logs (
                product_name,
                size_label,
                quantity,
                created_by,
                created_at,
                updated_at
            )
            VALUES (
                :product_name,
                :size_label,
                :quantity,
                :created_by,
                NOW(),
                NOW()
            )
        ");
        $logged = $logStmt->execute([
            ':product_name' => $product_name,
            ':size_label' => $size_label,
            ':quantity' => $quantity,
            ':created_by' => $user['id']
        ]);

        if (!$logged) {
            $db->rollBack();
            jsonResponse(false, "Failed to write stock log.", null, 500);
        }

        $activityLog->create(
            (int)$user['id'],
            'create_stock',
            "Added Stock"
        );

        $db->commit();
        jsonResponse(true, "Stock saved successfully.");
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(false, "Failed to save stock.", $e->getMessage(), 500);
    }
}

if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->query("
        SELECT s.*, u.full_name AS created_by_name
        FROM stocks s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.quantity > 0
        ORDER BY s.updated_at DESC, s.id DESC
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Stocks fetched.", $rows);
}

if ($action === 'today-logs' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $today = getTodayManilaDate();

    $stmt = $db->prepare("
        SELECT l.*, u.full_name AS created_by_name
        FROM stock_logs l
        LEFT JOIN users u ON l.created_by = u.id
        WHERE DATE(l.created_at) = :today
          AND l.quantity > 0
        ORDER BY l.created_at DESC, l.id DESC
    ");
    $stmt->execute([
        ':today' => $today
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Today stock logs fetched.", $rows);
}

if ($action === 'products' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $db->query("
        SELECT id, product_name
        FROM stock_products
        ORDER BY product_name ASC
    ");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Stock products fetched.", $rows);
}

if ($action === 'sizes' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $product_name = trim($_GET['product_name'] ?? '');

    if ($product_name === '') {
        jsonResponse(false, "Product name is required.", null, 422);
    }

    $stmt = $db->prepare("
        SELECT id, product_name, size_label, quantity
        FROM stocks
        WHERE product_name = :product_name
          AND quantity > 0
        ORDER BY FIELD(size_label, '350 ml', '500 ml', '1000 ml', '1500 ml', '4000 ml', '6000 ml')
    ");
    $stmt->execute([
        ':product_name' => $product_name
    ]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Stock sizes fetched.", $rows);
}

if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = getStocksRequestData();

    $id = (int)($data['id'] ?? 0);
    $product_name = trim($data['product_name'] ?? '');
    $size_label = trim($data['size_label'] ?? '');
    $quantity = (int)($data['quantity'] ?? -1);

    if ($id <= 0 || $product_name === '' || $size_label === '' || $quantity < 0) {
        jsonResponse(false, "Invalid stock update data.", null, 422);
    }

    $today = getTodayManilaDate();

    $findLog = $db->prepare("
        SELECT *
        FROM stock_logs
        WHERE id = :id
          AND DATE(created_at) = :today
          AND quantity > 0
        LIMIT 1
    ");
    $findLog->execute([
        ':id' => $id,
        ':today' => $today
    ]);
    $logRow = $findLog->fetch(PDO::FETCH_ASSOC);

    if (!$logRow) {
        jsonResponse(false, "Only today's added stock entries can be edited.", null, 422);
    }

    try {
        $db->beginTransaction();

        $oldQty = (int)$logRow['quantity'];

        $stockStmt = $db->prepare("
            SELECT id, quantity
            FROM stocks
            WHERE product_name = :product_name
              AND size_label = :size_label
            LIMIT 1
        ");
        $stockStmt->execute([
            ':product_name' => $product_name,
            ':size_label' => $size_label
        ]);
        $stockRow = $stockStmt->fetch(PDO::FETCH_ASSOC);

        if (!$stockRow) {
            $db->rollBack();
            jsonResponse(false, "Matching stock row not found.", null, 404);
        }

        $currentQty = (int)$stockRow['quantity'];
        $newStockQty = $currentQty - $oldQty + $quantity;

        if ($newStockQty < 0) {
            $db->rollBack();
            jsonResponse(false, "Updated quantity would make stock negative.", null, 422);
        }

        $updateStock = $db->prepare("
            UPDATE stocks
            SET quantity = :quantity,
                updated_at = NOW()
            WHERE id = :id
        ");
        $stockSaved = $updateStock->execute([
            ':quantity' => $newStockQty,
            ':id' => $stockRow['id']
        ]);

        if (!$stockSaved) {
            $db->rollBack();
            jsonResponse(false, "Failed to update stock.", null, 500);
        }

        $updateLog = $db->prepare("
            UPDATE stock_logs
            SET quantity = :quantity,
                updated_at = NOW()
            WHERE id = :id
        ");
        $logSaved = $updateLog->execute([
            ':quantity' => $quantity,
            ':id' => $id
        ]);

        if (!$logSaved) {
            $db->rollBack();
            jsonResponse(false, "Failed to update stock log.", null, 500);
        }

        $activityLog->create(
            (int)$user['id'],
            'update_stock',
            "Updated Stock"
        );

        $db->commit();
        jsonResponse(true, "Stock updated successfully.");
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(false, "Failed to update stock.", $e->getMessage(), 500);
    }
}

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(false, "Invalid stock ID.", null, 422);
    }

    $today = getTodayManilaDate();

    $findLog = $db->prepare("
        SELECT *
        FROM stock_logs
        WHERE id = :id
          AND DATE(created_at) = :today
          AND quantity > 0
        LIMIT 1
    ");
    $findLog->execute([
        ':id' => $id,
        ':today' => $today
    ]);
    $logRow = $findLog->fetch(PDO::FETCH_ASSOC);

    if (!$logRow) {
        jsonResponse(false, "Only today's added stock entries can be deleted.", null, 422);
    }

    try {
        $db->beginTransaction();

        $product_name = $logRow['product_name'];
        $size_label = $logRow['size_label'];
        $qty = (int)$logRow['quantity'];

        $stockStmt = $db->prepare("
            SELECT id, quantity
            FROM stocks
            WHERE product_name = :product_name
              AND size_label = :size_label
            LIMIT 1
        ");
        $stockStmt->execute([
            ':product_name' => $product_name,
            ':size_label' => $size_label
        ]);
        $stockRow = $stockStmt->fetch(PDO::FETCH_ASSOC);

        if (!$stockRow) {
            $db->rollBack();
            jsonResponse(false, "Matching stock row not found.", null, 404);
        }

        $currentQty = (int)$stockRow['quantity'];
        $newQty = $currentQty - $qty;

        if ($newQty < 0) {
            $db->rollBack();
            jsonResponse(false, "Delete would make stock negative.", null, 422);
        }

        if ($newQty === 0) {
            $deleteStockRow = $db->prepare("DELETE FROM stocks WHERE id = :id");
            $stockSaved = $deleteStockRow->execute([
                ':id' => $stockRow['id']
            ]);
        } else {
            $updateStock = $db->prepare("
                UPDATE stocks
                SET quantity = :quantity,
                    updated_at = NOW()
                WHERE id = :id
            ");
            $stockSaved = $updateStock->execute([
                ':quantity' => $newQty,
                ':id' => $stockRow['id']
            ]);
        }

        if (!$stockSaved) {
            $db->rollBack();
            jsonResponse(false, "Failed to update stock.", null, 500);
        }

        $deleteLog = $db->prepare("DELETE FROM stock_logs WHERE id = :id");
        $logDeleted = $deleteLog->execute([
            ':id' => $id
        ]);

        if (!$logDeleted) {
            $db->rollBack();
            jsonResponse(false, "Failed to delete stock log.", null, 500);
        }

        $activityLog->create(
            (int)$user['id'],
            'delete_stock',
            "Deleted Stock"
        );

        $db->commit();
        jsonResponse(true, "Stock deleted successfully.");
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(false, "Failed to delete stock.", $e->getMessage(), 500);
    }
}

jsonResponse(false, "Invalid stocks route.", null, 404);