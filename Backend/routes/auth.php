<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/utils.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$db = (new Database())->connect();
$action = $_GET['action'] ?? '';

function getRequestData() {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function isValidGmail(string $value): bool {
    return (bool) preg_match('/^[a-zA-Z0-9._%+\-]+@gmail\.com$/i', trim($value));
}

function extractUsernameFromEmail(string $email): string {
    $parts = explode('@', strtolower(trim($email)));
    return trim($parts[0] ?? '');
}

if ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = getRequestData();

    $email = strtolower(trim($data['username'] ?? ''));
    $password = trim($data['password'] ?? '');
    $role = strtolower(trim($data['role'] ?? ''));

    if ($email === '' || $password === '' || $role === '') {
        jsonResponse(false, "All login fields are required.", null, 422);
    }

    $stmt = $db->prepare("
        SELECT id, full_name, username, email, password, role
        FROM users
        WHERE LOWER(email) = :email
          AND role = :role
        LIMIT 1
    ");
    $stmt->execute([
        ':email' => $email,
        ':role' => $role
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        jsonResponse(false, "Invalid username or password.", null, 401);
    }

    $hash = $user['password'];
    $passwordOk = password_verify($password, $hash);
    if (!$passwordOk && strlen($password) > 1 && $password[0] === '$') {
        $passwordOk = password_verify(substr($password, 1), $hash);
    }

    if (!$passwordOk) {
        jsonResponse(false, "Invalid username or password.", null, 401);
    }

    $_SESSION['user'] = [
        'id' => $user['id'],
        'full_name' => $user['full_name'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role']
    ];

    jsonResponse(true, "Login successful.", [
        'user' => $_SESSION['user']
    ]);
}

if ($action === 'logout' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    session_unset();
    session_destroy();
    jsonResponse(true, "Logged out successfully.");
}

if ($action === 'me' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_SESSION['user'])) {
        jsonResponse(false, "Unauthorized.", null, 401);
    }

    jsonResponse(true, "Current user fetched.", $_SESSION['user']);
}

if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        jsonResponse(false, "Unauthorized.", null, 401);
    }

    $data = getRequestData();

    $full_name = trim($data['full_name'] ?? '');
    $email = strtolower(trim($data['username'] ?? ''));
    $password = trim($data['password'] ?? '');
    $role = strtolower(trim($data['role'] ?? 'staff'));
    $age = isset($data['age']) && $data['age'] !== '' ? (int) $data['age'] : null;
    $gender = trim($data['gender'] ?? '');

    if ($full_name === '' || $email === '' || $password === '') {
        jsonResponse(false, "Full name, Gmail, and password are required.", null, 422);
    }

    if ($role !== 'staff') {
        jsonResponse(false, "Only staff accounts can be created here.", null, 422);
    }

    if (!isValidGmail($email)) {
        jsonResponse(false, "Please enter a valid Gmail address ending in @gmail.com.", null, 422);
    }

    if (strlen($password) < 6) {
        jsonResponse(false, "Password must be at least 6 characters.", null, 422);
    }

    $check = $db->prepare("SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1");
    $check->execute([':email' => $email]);

    if ($check->fetch()) {
        jsonResponse(false, "Gmail already exists.", null, 409);
    }

    $username = extractUsernameFromEmail($email);
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $db->prepare("
        INSERT INTO users (
            full_name,
            age,
            gender,
            username,
            email,
            password,
            role,
            created_at,
            updated_at
        )
        VALUES (
            :full_name,
            :age,
            :gender,
            :username,
            :email,
            :password,
            :role,
            NOW(),
            NOW()
        )
    ");

    $saved = $stmt->execute([
        ':full_name' => $full_name,
        ':age' => $age,
        ':gender' => $gender !== '' ? $gender : null,
        ':username' => $username,
        ':email' => $email,
        ':password' => $hashedPassword,
        ':role' => $role
    ]);

    if (!$saved) {
        jsonResponse(false, "Failed to create staff account.", null, 500);
    }

    jsonResponse(true, "Staff account created successfully.");
}

if ($action === 'staff-list' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        jsonResponse(false, "Unauthorized.", null, 401);
    }

    $filterDate = trim($_GET['date'] ?? '');

    $sql = "
        SELECT
            id,
            full_name,
            age,
            gender,
            email AS username,
            email,
            role,
            created_at,
            updated_at
        FROM users
        WHERE role = 'staff'
    ";

    $params = [];

    if ($filterDate !== '') {
        $sql .= " AND DATE(created_at) = :filter_date ";
        $params[':filter_date'] = $filterDate;
    }

    $sql .= " ORDER BY created_at DESC, id DESC ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    jsonResponse(true, "Staff list fetched.", $rows);
}

if ($action === 'edit-staff' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        jsonResponse(false, "Unauthorized.", null, 401);
    }

    $data = getRequestData();

    $id = (int) ($data['id'] ?? 0);
    $full_name = trim($data['full_name'] ?? '');
    $email = strtolower(trim($data['username'] ?? ''));
    $age = isset($data['age']) && $data['age'] !== '' ? (int) $data['age'] : null;
    $gender = trim($data['gender'] ?? '');

    if ($id <= 0 || $full_name === '' || $email === '') {
        jsonResponse(false, "ID, full name, and Gmail are required.", null, 422);
    }

    if (!isValidGmail($email)) {
        jsonResponse(false, "Please enter a valid Gmail address ending in @gmail.com.", null, 422);
    }

    $check = $db->prepare("
        SELECT id
        FROM users
        WHERE LOWER(email) = :email
          AND id <> :id
        LIMIT 1
    ");
    $check->execute([
        ':email' => $email,
        ':id' => $id
    ]);

    if ($check->fetch()) {
        jsonResponse(false, "Gmail already exists.", null, 409);
    }

    $username = extractUsernameFromEmail($email);

    $stmt = $db->prepare("
        UPDATE users
        SET full_name = :full_name,
            age = :age,
            gender = :gender,
            username = :username,
            email = :email,
            updated_at = NOW()
        WHERE id = :id
          AND role = 'staff'
    ");

    $updated = $stmt->execute([
        ':full_name' => $full_name,
        ':age' => $age,
        ':gender' => $gender !== '' ? $gender : null,
        ':username' => $username,
        ':email' => $email,
        ':id' => $id
    ]);

    if (!$updated) {
        jsonResponse(false, "Failed to update staff.", null, 500);
    }

    jsonResponse(true, "Staff updated successfully.");
}

if ($action === 'delete-staff' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        jsonResponse(false, "Unauthorized.", null, 401);
    }

    $id = (int) ($_GET['id'] ?? 0);

    if ($id <= 0) {
        jsonResponse(false, "Invalid staff ID.", null, 422);
    }

    $stmt = $db->prepare("
        DELETE FROM users
        WHERE id = :id
          AND role = 'staff'
    ");
    $deleted = $stmt->execute([':id' => $id]);

    if (!$deleted) {
        jsonResponse(false, "Failed to delete staff.", null, 500);
    }

    jsonResponse(true, "Staff deleted successfully.");
}

if ($action === 'reset-staff-password' && $_SERVER['REQUEST_METHOD'] === 'PUT') {
    if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
        jsonResponse(false, "Unauthorized.", null, 401);
    }

    $data = getRequestData();

    $id = (int) ($data['id'] ?? 0);
    $new_password = trim($data['new_password'] ?? '');

    if ($id <= 0 || $new_password === '') {
        jsonResponse(false, "Staff ID and new password are required.", null, 422);
    }

    if (strlen($new_password) < 6) {
        jsonResponse(false, "Password must be at least 6 characters.", null, 422);
    }

    $check = $db->prepare("
        SELECT id
        FROM users
        WHERE id = :id
          AND role = 'staff'
        LIMIT 1
    ");
    $check->execute([':id' => $id]);

    if (!$check->fetch()) {
        jsonResponse(false, "Staff account not found.", null, 404);
    }

    $hashedPassword = password_hash($new_password, PASSWORD_DEFAULT);

    $stmt = $db->prepare("
        UPDATE users
        SET password = :password,
            updated_at = NOW()
        WHERE id = :id
          AND role = 'staff'
    ");

    $updated = $stmt->execute([
        ':password' => $hashedPassword,
        ':id' => $id
    ]);

    if (!$updated) {
        jsonResponse(false, "Failed to reset staff password.", null, 500);
    }

    jsonResponse(true, "Staff password reset successfully.");
}

jsonResponse(false, "Route not found", null, 404);