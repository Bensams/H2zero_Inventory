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

$action = $_GET['action'] ?? '';
$user = $_SESSION['user'];

function getInventoryRequestData() {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function applyStockMovement(PDO $db, int $userId, string $productName, string $sizeLabel, int $qtyChange): array {
    if ($qtyChange === 0) {
        return ['success' => true];
    }

    $stmt = $db->prepare("
        SELECT id, quantity
        FROM stocks
        WHERE product_name = :product_name
          AND size_label = :size_label
        LIMIT 1
    ");
    $stmt->execute([
        ':product_name' => $productName,
        ':size_label' => $sizeLabel
    ]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row && $qtyChange > 0) {
        $insert = $db->prepare("
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
        $saved = $insert->execute([
            ':product_name' => $productName,
            ':size_label' => $sizeLabel,
            ':quantity' => $qtyChange,
            ':created_by' => $userId
        ]);

        if (!$saved) {
            return [
                'success' => false,
                'message' => "Failed to recreate stock row for {$productName} ({$sizeLabel})."
            ];
        }

        $log = $db->prepare("
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
        $log->execute([
            ':product_name' => $productName,
            ':size_label' => $sizeLabel,
            ':quantity' => $qtyChange,
            ':created_by' => $userId
        ]);

        return ['success' => true];
    }

    if (!$row && $qtyChange < 0) {
        return [
            'success' => false,
            'message' => "No stock found for {$productName} ({$sizeLabel})."
        ];
    }

    $currentQty = (int)$row['quantity'];
    $newQty = $currentQty + $qtyChange;

    if ($newQty < 0) {
        return [
            'success' => false,
            'message' => "Insufficient stock for {$productName} ({$sizeLabel}). Available: {$currentQty}."
        ];
    }

    if ($newQty === 0) {
        $deleteStmt = $db->prepare("DELETE FROM stocks WHERE id = :id");
        $saved = $deleteStmt->execute([
            ':id' => $row['id']
        ]);
    } else {
        $update = $db->prepare("
            UPDATE stocks
            SET quantity = :quantity,
                updated_at = NOW()
            WHERE id = :id
        ");
        $saved = $update->execute([
            ':quantity' => $newQty,
            ':id' => $row['id']
        ]);
    }

    if (!$saved) {
        return [
            'success' => false,
            'message' => "Failed to update current stock."
        ];
    }

    $log = $db->prepare("
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
    $logged = $log->execute([
        ':product_name' => $productName,
        ':size_label' => $sizeLabel,
        ':quantity' => $qtyChange,
        ':created_by' => $userId
    ]);

    if (!$logged) {
        return [
            'success' => false,
            'message' => "Failed to write stock log."
        ];
    }

    return ['success' => true];
}

if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getInventoryRequestData();

    $item_name = trim($data['item_name'] ?? '');
    $category = trim($data['category'] ?? '');
    $quantity = (int)($data['quantity'] ?? 0);
    $unit = trim($data['unit'] ?? 'pcs');

    if ($item_name === '' || $category === '' || $quantity <= 0) {
        jsonResponse(false, "Item name, category, and quantity are required.", null, 422);
    }

    try {
        $db->beginTransaction();

        $stockMove = applyStockMovement($db, (int)$user['id'], $item_name, $category, -$quantity);
        if (!$stockMove['success']) {
            $db->rollBack();
            jsonResponse(false, $stockMove['message'], null, 422);
        }

        $stmt = $db->prepare("
            INSERT INTO inventory (
                item_name,
                category,
                quantity,
                unit,
                added_by,
                date_added,
                updated_at
            )
            VALUES (
                :item_name,
                :category,
                :quantity,
                :unit,
                :added_by,
                NOW(),
                NOW()
            )
        ");

        $saved = $stmt->execute([
            ':item_name' => $item_name,
            ':category' => $category,
            ':quantity' => $quantity,
            ':unit' => $unit,
            ':added_by' => $user['id']
        ]);

        if (!$saved) {
            $db->rollBack();
            jsonResponse(false, "Failed to save inventory.", null, 500);
        }

        $activityLog->create(
            (int)$user['id'],
            'create_inventory',
            "Added Inventory"
        );

        $db->commit();
        jsonResponse(true, "Inventory saved successfully.");
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(false, "Failed to save inventory.", $e->getMessage(), 500);
    }
}

if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = getInventoryRequestData();

    $id = (int)($data['id'] ?? 0);
    $item_name = trim($data['item_name'] ?? '');
    $category = trim($data['category'] ?? '');
    $quantity = (int)($data['quantity'] ?? 0);
    $unit = trim($data['unit'] ?? 'pcs');

    if ($id <= 0 || $item_name === '' || $category === '' || $quantity < 0) {
        jsonResponse(false, "Invalid inventory update data.", null, 422);
    }

    if ($user['role'] === 'admin') {
        $find = $db->prepare("SELECT * FROM inventory WHERE id = :id LIMIT 1");
        $find->execute([':id' => $id]);
    } else {
        $find = $db->prepare("SELECT * FROM inventory WHERE id = :id AND added_by = :added_by LIMIT 1");
        $find->execute([
            ':id' => $id,
            ':added_by' => $user['id']
        ]);
    }

    $oldRow = $find->fetch(PDO::FETCH_ASSOC);
    if (!$oldRow) {
        jsonResponse(false, "Inventory record not found.", null, 404);
    }

    try {
        $db->beginTransaction();

        $restoreOld = applyStockMovement(
            $db,
            (int)$user['id'],
            $oldRow['item_name'],
            $oldRow['category'],
            (int)$oldRow['quantity']
        );

        if (!$restoreOld['success']) {
            $db->rollBack();
            jsonResponse(false, $restoreOld['message'], null, 422);
        }

        if ($quantity > 0) {
            $deductNew = applyStockMovement(
                $db,
                (int)$user['id'],
                $item_name,
                $category,
                -$quantity
            );

            if (!$deductNew['success']) {
                $db->rollBack();
                jsonResponse(false, $deductNew['message'], null, 422);
            }
        }

        if ($user['role'] === 'admin') {
            $stmt = $db->prepare("
                UPDATE inventory
                SET item_name = :item_name,
                    category = :category,
                    quantity = :quantity,
                    unit = :unit,
                    updated_at = NOW()
                WHERE id = :id
            ");
            $updated = $stmt->execute([
                ':item_name' => $item_name,
                ':category' => $category,
                ':quantity' => $quantity,
                ':unit' => $unit,
                ':id' => $id
            ]);
        } else {
            $stmt = $db->prepare("
                UPDATE inventory
                SET item_name = :item_name,
                    category = :category,
                    quantity = :quantity,
                    unit = :unit,
                    updated_at = NOW()
                WHERE id = :id
                  AND added_by = :added_by
            ");
            $updated = $stmt->execute([
                ':item_name' => $item_name,
                ':category' => $category,
                ':quantity' => $quantity,
                ':unit' => $unit,
                ':id' => $id,
                ':added_by' => $user['id']
            ]);
        }

        if (!$updated) {
            $db->rollBack();
            jsonResponse(false, "Failed to update inventory.", null, 500);
        }

        $activityLog->create(
            (int)$user['id'],
            'update_inventory',
            "Updated Inventory"
        );

        $db->commit();
        jsonResponse(true, "Inventory updated successfully.");
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(false, "Failed to update inventory.", $e->getMessage(), 500);
    }
}

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(false, "Invalid inventory ID.", null, 422);
    }

    if ($user['role'] === 'admin') {
        $find = $db->prepare("SELECT * FROM inventory WHERE id = :id LIMIT 1");
        $find->execute([':id' => $id]);
    } else {
        $find = $db->prepare("SELECT * FROM inventory WHERE id = :id AND added_by = :added_by LIMIT 1");
        $find->execute([
            ':id' => $id,
            ':added_by' => $user['id']
        ]);
    }

    $oldRow = $find->fetch(PDO::FETCH_ASSOC);
    if (!$oldRow) {
        jsonResponse(false, "Inventory record not found.", null, 404);
    }

    try {
        $db->beginTransaction();

        $restore = applyStockMovement(
            $db,
            (int)$user['id'],
            $oldRow['item_name'],
            $oldRow['category'],
            (int)$oldRow['quantity']
        );

        if (!$restore['success']) {
            $db->rollBack();
            jsonResponse(false, $restore['message'], null, 422);
        }

        if ($user['role'] === 'admin') {
            $stmt = $db->prepare("DELETE FROM inventory WHERE id = :id");
            $deleted = $stmt->execute([':id' => $id]);
        } else {
            $stmt = $db->prepare("DELETE FROM inventory WHERE id = :id AND added_by = :added_by");
            $deleted = $stmt->execute([
                ':id' => $id,
                ':added_by' => $user['id']
            ]);
        }

        if (!$deleted) {
            $db->rollBack();
            jsonResponse(false, "Failed to delete inventory.", null, 500);
        }

        $activityLog->create(
            (int)$user['id'],
            'delete_inventory',
            "Deleted Inventory"
        );

        $db->commit();
        jsonResponse(true, "Inventory deleted successfully.");
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        jsonResponse(false, "Failed to delete inventory.", $e->getMessage(), 500);
    }
}

if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $filterDate = trim($_GET['date'] ?? '');

    $sql = "
        SELECT i.*, u.full_name AS added_by_name
        FROM inventory i
        LEFT JOIN users u ON i.added_by = u.id
    ";
    $params = [];

    if ($filterDate !== '') {
        $sql .= " WHERE DATE(i.date_added) = :filter_date ";
        $params[':filter_date'] = $filterDate;
    }

    $sql .= " ORDER BY i.date_added DESC, i.id DESC ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Inventory list fetched.", $rows);
}

if ($action === 'mine' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $filterDate = trim($_GET['date'] ?? '');

    $sql = "
        SELECT i.*, u.full_name AS added_by_name
        FROM inventory i
        LEFT JOIN users u ON i.added_by = u.id
        WHERE i.added_by = :added_by
    ";
    $params = [
        ':added_by' => $user['id']
    ];

    if ($filterDate !== '') {
        $sql .= " AND DATE(i.date_added) = :filter_date ";
        $params[':filter_date'] = $filterDate;
    }

    $sql .= " ORDER BY i.date_added DESC, i.id DESC ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "My inventory fetched.", $rows);
}

jsonResponse(false, "Invalid inventory route.", null, 404);