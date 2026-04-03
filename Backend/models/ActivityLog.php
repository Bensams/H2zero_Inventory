<?php
class ActivityLog {
    private PDO $conn;
    private string $table = "activity_logs";

    public function __construct(PDO $db) {
        $this->conn = $db;
    }

    public function create(int $user_id, string $action, string $description): bool {
        $sql = "INSERT INTO {$this->table} (user_id, action, description, created_at)
                VALUES (:user_id, :action, :description, NOW())";

        $stmt = $this->conn->prepare($sql);
        return $stmt->execute([
            ':user_id' => $user_id,
            ':action' => $action,
            ':description' => $description
        ]);
    }

    public function getAll(?string $date = null): array {
        if ($date !== null && $date !== '') {
            $sql = "SELECT a.id, a.user_id, a.action, a.description, a.created_at, u.full_name
                    FROM {$this->table} a
                    LEFT JOIN users u ON a.user_id = u.id
                    WHERE DATE(a.created_at) = :filter_date
                    ORDER BY a.id DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([':filter_date' => $date]);
        } else {
            $sql = "SELECT a.id, a.user_id, a.action, a.description, a.created_at, u.full_name
                    FROM {$this->table} a
                    LEFT JOIN users u ON a.user_id = u.id
                    ORDER BY a.id DESC";
            $stmt = $this->conn->query($sql);
        }

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}