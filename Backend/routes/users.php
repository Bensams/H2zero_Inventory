<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/validator.php';
require_once __DIR__ . '/../helpers/utils.php';
require_once __DIR__ . '/../middleware/adminMiddleware.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/ActivityLog.php';

$db = (new Database())->connect();
$userModel = new User($db);
$logModel = new ActivityLog($db);

$currentUser = requireAdmin();
$action = $_GET['action'] ?? '';

if ($action === 'list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $users = $userModel->getAll();
    jsonResponse(true, "Users fetched successfully", $users);
}

if ($action === 'update' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = getJsonInput();
    $missing = requireFields($data, ['id', 'full_name', 'username', 'role']);

    if (!empty($missing)) {
        jsonResponse(false, "Missing required fields", ['missing' => $missing], 422);
    }

    if (!isValidRole($data['role'])) {
        jsonResponse(false, "Invalid role", null, 422);
    }

    $updated = $userModel->update(
        (int)$data['id'],
        trim($data['full_name']),
        trim($data['username']),
        trim($data['role'])
    );

    if ($updated) {
        $logModel->create((int)$currentUser['id'], 'UPDATE_USER', "Updated user ID: {$data['id']}");
        jsonResponse(true, "User updated successfully");
    }

    jsonResponse(false, "Failed to update user", null, 500);
}

if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(false, "Invalid user ID", null, 422);
    }

    if ($id === (int)$currentUser['id']) {
        jsonResponse(false, "You cannot delete your own account", null, 400);
    }

    $deleted = $userModel->delete($id);

    if ($deleted) {
        $logModel->create((int)$currentUser['id'], 'DELETE_USER', "Deleted user ID: {$id}");
        jsonResponse(true, "User deleted successfully");
    }

    jsonResponse(false, "Failed to delete user", null, 500);
}

jsonResponse(false, "Invalid users route", null, 404);