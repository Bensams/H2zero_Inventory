<?php

require_once __DIR__ . '/../helpers/password.php';

class User {
    private PDO $conn;
    private string $table = "users";

    public function __construct(PDO $db) {
        $this->conn = $db;
    }

    public function create(string $full_name, string $username, string $password, string $role): bool {
        $sql = "INSERT INTO {$this->table} (full_name, username, password, role, created_at)
                VALUES (:full_name, :username, :password, :role, NOW())";

        $stmt = $this->conn->prepare($sql);
        $hashedPassword = auth_password_hash($password);

        return $stmt->execute([
            ':full_name' => $full_name,
            ':username' => $username,
            ':password' => $hashedPassword,
            ':role' => $role
        ]);
    }

    public function findByUsername(string $username): ?array {
        $sql = "SELECT * FROM {$this->table} WHERE username = :username LIMIT 1";
        $stmt = $this->conn->prepare($sql);
        $stmt->execute([':username' => $username]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ?: null;
    }

    public function getAll(): array {
        $sql = "SELECT id, full_name, username, role, created_at FROM {$this->table} ORDER BY id DESC";
        $stmt = $this->conn->query($sql);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}