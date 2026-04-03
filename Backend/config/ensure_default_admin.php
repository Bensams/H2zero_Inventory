<?php

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/../helpers/password.php';

/**
 * On each request, if there is no admin user, create the default administrator.
 * Skipped when DISABLE_AUTO_ADMIN=1.
 */
function inventory_ensure_default_admin(): void
{
    if (getenv('DISABLE_AUTO_ADMIN') === '1') {
        return;
    }

    $db = (new Database())->connect();

    try {
        $adminCount = (int) $db->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();
        if ($adminCount > 0) {
            return;
        }

        $stmt = $db->prepare('SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1');
        $stmt->execute([':email' => 'admin@gmail.com']);
        if ($stmt->fetch()) {
            return;
        }

        $hash = auth_password_hash('admin123');
        $ins = $db->prepare("
            INSERT INTO users (
                full_name, age, gender, username, email, password, role, created_at, updated_at
            ) VALUES (
                :full_name, NULL, NULL, :username, :email, :password, 'admin', NOW(), NOW()
            )
        ");
        $ins->execute([
            ':full_name' => 'Administrator',
            ':username' => 'admin',
            ':email' => 'admin@gmail.com',
            ':password' => $hash,
        ]);
    } catch (PDOException $e) {
        // Duplicate email / race with another request creating the admin.
    }
}
