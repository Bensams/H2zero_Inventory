<?php
class Inventory {
    private PDO $conn;
    private string $table = "inventory";

    public function __construct(PDO $db) {
        $this->conn = $db;
    }

    public function create(string $item_name, string $category, int $quantity, string $unit, int $added_by): bool {
        $sql = "INSERT INTO {$this->table} (item_name, category, quantity, unit, added_by, date_added, updated_at)
                VALUES (:item_name, :category, :quantity, :unit, :added_by, NOW(), NOW())";

        $stmt = $this->conn->prepare($sql);
        return $stmt->execute([
            ':item_name' => $item_name,
            ':category' => $category,
            ':quantity' => $quantity,
            ':unit' => $unit,
            ':added_by' => $added_by
        ]);
    }

    public function getAll(): array {
        $sql = "SELECT i.*, u.full_name AS added_by_name
                FROM {$this->table} i
                LEFT JOIN users u ON i.added_by = u.id
                ORDER BY i.id DESC";

        $stmt = $this->conn->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getByUserId(int $userId): array {
        $sql = "SELECT i.*, u.full_name AS added_by_name
                FROM {$this->table} i
                LEFT JOIN users u ON i.added_by = u.id
                WHERE i.added_by = :user_id
                ORDER BY i.id DESC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':user_id' => $userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById(int $id): ?array {
        $sql = "SELECT * FROM {$this->table} WHERE id = :id LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':id' => $id]);

        $item = $stmt->fetch(PDO::FETCH_ASSOC);
        return $item ?: null;
    }

    public function update(int $id, string $item_name, string $category, int $quantity, string $unit): bool {
        $sql = "UPDATE {$this->table}
                SET item_name = :item_name,
                    category = :category,
                    quantity = :quantity,
                    unit = :unit,
                    updated_at = NOW()
                WHERE id = :id";

        $stmt = $this->conn->prepare($sql);
        return $stmt->execute([
            ':item_name' => $item_name,
            ':category' => $category,
            ':quantity' => $quantity,
            ':unit' => $unit,
            ':id' => $id
        ]);
    }

    public function delete(int $id): bool {
        $sql = "DELETE FROM {$this->table} WHERE id = :id";
        $stmt = $this->conn->prepare($sql);
        return $stmt->execute([':id' => $id]);
    }

    public function countAll(): int {
        $sql = "SELECT COUNT(DISTINCT item_name) as total FROM {$this->table}";
        $stmt = $this->conn->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$row['total'];
    }

    public function totalQuantity(): int {
        $sql = "SELECT COALESCE(SUM(quantity), 0) as total_qty FROM {$this->table}";
        $stmt = $this->conn->query($sql);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$row['total_qty'];
    }

    public function lowStock(int $threshold = 10): array {
        $sql = "SELECT * FROM {$this->table} WHERE quantity <= :threshold ORDER BY quantity ASC";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':threshold' => $threshold]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}