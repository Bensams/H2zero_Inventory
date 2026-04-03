<?php

class Database
{
    private string $host;
    private string $port;
    private string $db_name;
    private string $username;
    private string $password;
    public ?PDO $conn = null;

    public function __construct()
    {
        $this->host = getenv('MYSQLHOST') ?: getenv('DB_HOST') ?: 'localhost';
        $this->port = getenv('MYSQLPORT') ?: getenv('DB_PORT') ?: '3306';
        $this->db_name = getenv('MYSQLDATABASE') ?: getenv('DB_NAME') ?: 'railway';
        $this->username = getenv('MYSQLUSER') ?: getenv('DB_USER') ?: 'root';
        $mysqlPassword = getenv('MYSQLPASSWORD');
        $this->password = $mysqlPassword !== false
            ? $mysqlPassword
            : (getenv('DB_PASSWORD') ?: '');
    }

    public function connect(): ?PDO
    {
        $this->conn = null;

        try {
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->db_name};charset=utf8mb4";
            $this->conn = new PDO($dsn, $this->username, $this->password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            $this->conn->exec("SET time_zone = '+08:00'");
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database connection failed',
                'error' => $e->getMessage(),
            ]);
            exit;
        }

        return $this->conn;
    }
}
