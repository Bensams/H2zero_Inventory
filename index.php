<?php

require_once __DIR__ . '/Backend/config/bootstrap.php';
require_once __DIR__ . '/Backend/config/cors.php';

session_start();

require_once __DIR__ . '/Backend/config/constants.php';
require_once __DIR__ . '/Backend/config/ensure_default_admin.php';
inventory_ensure_default_admin();

$route = $_GET['route'] ?? '';

switch ($route) {
    case 'auth':
        require_once __DIR__ . '/Backend/routes/auth.php';
        break;

    case 'inventory':
        require_once __DIR__ . '/Backend/routes/inventory.php';
        break;

    case 'dashboard':
        require_once __DIR__ . '/Backend/routes/dashboard.php';
        break;

    case 'users':
        require_once __DIR__ . '/Backend/routes/users.php';
        break;

    case 'reports':
        require_once __DIR__ . '/Backend/routes/reports.php';
        break;

    case 'stocks':
        require_once __DIR__ . '/Backend/routes/stocks.php';
        break;

    case 'stock-products':
        require_once __DIR__ . '/Backend/routes/stock-products.php';
        break;

    default:
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Route not found"
        ]);
        exit;
}