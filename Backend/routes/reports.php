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

if ($action === 'inventory' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $filterDate = trim($_GET['date'] ?? '');

    $sql = "
        SELECT 
            i.*,
            u.full_name AS added_by_name
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

    jsonResponse(true, "Inventory report fetched.", $rows);
}

if ($action === 'activity' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $filterDate = trim($_GET['date'] ?? '');

    $sql = "
        SELECT 
            a.id,
            a.user_id,
            a.action,
            a.description,
            a.created_at,
            u.full_name
        FROM activity_logs a
        LEFT JOIN users u ON a.user_id = u.id
    ";

    $params = [];

    if ($filterDate !== '') {
        $sql .= " WHERE DATE(a.created_at) = :filter_date ";
        $params[':filter_date'] = $filterDate;
    }

    $sql .= " ORDER BY a.created_at DESC, a.id DESC ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Activity report fetched.", $rows);
}

jsonResponse(false, "Invalid reports route.", null, 404);