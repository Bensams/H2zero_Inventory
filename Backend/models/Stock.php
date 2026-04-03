<?php
class Stock {
    private PDO $conn;
    private string $table = "stocks";
    private string $logsTable = "stock_logs";

    public function __construct(PDO $db) {
        $this->conn = $db;
    }

    public function createOrAdd(string $product_name, string $size_label, int $quantity, ?int $created_by): bool {
        try {
            $this->conn->beginTransaction();

            $sql = "
                INSERT INTO {$this->table} (product_name, size_label, quantity, created_by, created_at, updated_at)
                VALUES (:product_name, :size_label, :quantity, :created_by, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    quantity = quantity + VALUES(quantity),
                    updated_at = NOW()
            ";
            $stmt = $this->conn->prepare($sql);
            $okMain = $stmt->execute([
                ':product_name' => $product_name,
                ':size_label' => $size_label,
                ':quantity' => $quantity,
                ':created_by' => $created_by
            ]);

            if (!$okMain) {
                $this->conn->rollBack();
                return false;
            }

            $logSql = "
                INSERT INTO {$this->logsTable} (product_name, size_label, quantity, created_by, created_at, updated_at)
                VALUES (:product_name, :size_label, :quantity, :created_by, NOW(), NOW())
            ";
            $logStmt = $this->conn->prepare($logSql);
            $okLog = $logStmt->execute([
                ':product_name' => $product_name,
                ':size_label' => $size_label,
                ':quantity' => $quantity,
                ':created_by' => $created_by
            ]);

            if (!$okLog) {
                $this->conn->rollBack();
                return false;
            }

            $this->conn->commit();
            return true;
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return false;
        }
    }

    public function getAll(): array {
        $sql = "
            SELECT s.*, u.full_name AS created_by_name
            FROM {$this->table} s
            LEFT JOIN users u ON s.created_by = u.id
            ORDER BY s.product_name ASC,
                     FIELD(s.size_label, '350 ml', '500 ml', '1000 ml', '1500 ml', '4000 ml', '6000 ml')
        ";
        $stmt = $this->conn->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getByUserId(int $userId): array {
        $sql = "
            SELECT s.*, u.full_name AS created_by_name
            FROM {$this->table} s
            LEFT JOIN users u ON s.created_by = u.id
            WHERE s.created_by = :user_id
            ORDER BY s.product_name ASC,
                     FIELD(s.size_label, '350 ml', '500 ml', '1000 ml', '1500 ml', '4000 ml', '6000 ml')
        ";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':user_id' => $userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getTodayLogs(?int $userId = null): array {
        $sql = "
            SELECT l.*, u.full_name AS created_by_name
            FROM {$this->logsTable} l
            LEFT JOIN users u ON l.created_by = u.id
            WHERE DATE(l.created_at) = CURDATE()
        ";
        $params = [];

        if ($userId !== null) {
            $sql .= " AND l.created_by = :user_id ";
            $params[':user_id'] = $userId;
        }

        $sql .= " ORDER BY l.created_at DESC, l.id DESC ";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getLogById(int $id): ?array {
        $sql = "SELECT * FROM {$this->logsTable} WHERE id = :id LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function updateTodayLog(int $id, string $product_name, string $size_label, int $quantity, int $userId, bool $isAdmin): bool {
        $log = $this->getLogById($id);
        if (!$log) return false;

       $logDate = date('Y-m-d', strtotime($log['created_at']));
$today = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');

if ($logDate !== $today) {
    return false;
}

        if (!$isAdmin && (int)$log['created_by'] !== $userId) {
            return false;
        }

        try {
            $this->conn->beginTransaction();

            $oldQty = (int)$log['quantity'];
            $oldProduct = $log['product_name'];
            $oldSize = $log['size_label'];

            // 1. Reverse the old log from cumulative stocks
            $reverseSql = "
                UPDATE {$this->table}
                SET quantity = quantity - :old_qty,
                    updated_at = NOW()
                WHERE product_name = :old_product
                  AND size_label = :old_size
            ";
            $reverseStmt = $this->conn->prepare($reverseSql);
            $reverseStmt->execute([
                ':old_qty' => $oldQty,
                ':old_product' => $oldProduct,
                ':old_size' => $oldSize
            ]);

            // 2. Prevent negative cumulative quantity
            $checkSql = "
                SELECT quantity
                FROM {$this->table}
                WHERE product_name = :product_name
                  AND size_label = :size_label
                LIMIT 1
            ";
            $checkStmt = $this->conn->prepare($checkSql);
            $checkStmt->execute([
                ':product_name' => $oldProduct,
                ':size_label' => $oldSize
            ]);
            $checkRow = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($checkRow && (int)$checkRow['quantity'] < 0) {
                $this->conn->rollBack();
                return false;
            }

            // 3. Apply the new quantity into cumulative stocks
            $applySql = "
                INSERT INTO {$this->table} (product_name, size_label, quantity, created_by, created_at, updated_at)
                VALUES (:product_name, :size_label, :quantity, :created_by, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    quantity = quantity + VALUES(quantity),
                    updated_at = NOW()
            ";
            $applyStmt = $this->conn->prepare($applySql);
            $applyStmt->execute([
                ':product_name' => $product_name,
                ':size_label' => $size_label,
                ':quantity' => $quantity,
                ':created_by' => $userId
            ]);

            // 4. Update the daily log row
            $logSql = "
                UPDATE {$this->logsTable}
                SET product_name = :product_name,
                    size_label = :size_label,
                    quantity = :quantity,
                    updated_at = NOW()
                WHERE id = :id
            ";
            $logStmt = $this->conn->prepare($logSql);
            $ok = $logStmt->execute([
                ':product_name' => $product_name,
                ':size_label' => $size_label,
                ':quantity' => $quantity,
                ':id' => $id
            ]);

            if (!$ok) {
                $this->conn->rollBack();
                return false;
            }

            // 5. Delete zero rows from cumulative stocks
            $cleanupSql = "DELETE FROM {$this->table} WHERE quantity <= 0";
            $this->conn->exec($cleanupSql);

            $this->conn->commit();
            return true;
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return false;
        }
    }

    public function deleteTodayLog(int $id, int $userId, bool $isAdmin): bool {
        $log = $this->getLogById($id);
        if (!$log) return false;

        $logDate = date('Y-m-d', strtotime($log['created_at']));
$today = (new DateTime('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d');

if ($logDate !== $today) {
    return false;
}

        if (!$isAdmin && (int)$log['created_by'] !== $userId) {
            return false;
        }

        try {
            $this->conn->beginTransaction();

            $qty = (int)$log['quantity'];
            $product = $log['product_name'];
            $size = $log['size_label'];

            // 1. Reverse this log from cumulative stocks
            $reverseSql = "
                UPDATE {$this->table}
                SET quantity = quantity - :qty,
                    updated_at = NOW()
                WHERE product_name = :product_name
                  AND size_label = :size_label
            ";
            $reverseStmt = $this->conn->prepare($reverseSql);
            $reverseStmt->execute([
                ':qty' => $qty,
                ':product_name' => $product,
                ':size_label' => $size
            ]);

            // 2. Prevent negative totals
            $checkSql = "
                SELECT quantity
                FROM {$this->table}
                WHERE product_name = :product_name
                  AND size_label = :size_label
                LIMIT 1
            ";
            $checkStmt = $this->conn->prepare($checkSql);
            $checkStmt->execute([
                ':product_name' => $product,
                ':size_label' => $size
            ]);
            $checkRow = $checkStmt->fetch(PDO::FETCH_ASSOC);

            if ($checkRow && (int)$checkRow['quantity'] < 0) {
                $this->conn->rollBack();
                return false;
            }

            // 3. Delete the daily log
            $deleteSql = "DELETE FROM {$this->logsTable} WHERE id = :id";
            $deleteStmt = $this->conn->prepare($deleteSql);
            $ok = $deleteStmt->execute([':id' => $id]);

            if (!$ok) {
                $this->conn->rollBack();
                return false;
            }

            // 4. Remove zero rows from cumulative table
            $cleanupSql = "DELETE FROM {$this->table} WHERE quantity <= 0";
            $this->conn->exec($cleanupSql);

            $this->conn->commit();
            return true;
        } catch (Throwable $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return false;
        }
    }

    public function getProducts(): array {
        $sql = "
            SELECT DISTINCT product_name
            FROM {$this->table}
            WHERE quantity > 0
            ORDER BY product_name ASC
        ";
        $stmt = $this->conn->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSizesByProduct(string $product_name): array {
        $sql = "
            SELECT id, product_name, size_label, quantity
            FROM {$this->table}
            WHERE product_name = :product_name
              AND quantity > 0
            ORDER BY FIELD(size_label, '350 ml', '500 ml', '1000 ml', '1500 ml', '4000 ml', '6000 ml')
        ";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':product_name' => $product_name]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getSingle(string $product_name, string $size_label): ?array {
        $sql = "
            SELECT *
            FROM {$this->table}
            WHERE product_name = :product_name
              AND size_label = :size_label
            LIMIT 1
        ";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':product_name' => $product_name,
            ':size_label' => $size_label
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function deduct(string $product_name, string $size_label, int $quantity): bool {
        $sql = "
            UPDATE {$this->table}
            SET quantity = quantity - :quantity,
                updated_at = NOW()
            WHERE product_name = :product_name
              AND size_label = :size_label
              AND quantity >= :quantity
        ";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':quantity' => $quantity,
            ':product_name' => $product_name,
            ':size_label' => $size_label
        ]);

        if ($stmt->rowCount() > 0) {
            $this->conn->exec("DELETE FROM {$this->table} WHERE quantity <= 0");
            return true;
        }

        return false;
    }
}