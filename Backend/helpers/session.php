<?php
function startSessionIfNeeded(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function setUserSession(array $user): void {
    startSessionIfNeeded();

    $_SESSION['user'] = [
        'id' => $user['id'],
        'full_name' => $user['full_name'],
        'username' => $user['username'],
        'role' => $user['role']
    ];
}

function getCurrentUser(): ?array {
    startSessionIfNeeded();
    return $_SESSION['user'] ?? null;
}

function destroyUserSession(): void {
    startSessionIfNeeded();
    $_SESSION = [];
    session_destroy();
}