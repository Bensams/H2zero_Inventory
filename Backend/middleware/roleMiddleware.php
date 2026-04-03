<?php
require_once __DIR__ . '/authMiddleware.php';

function requireRole(array $roles): array {
    $user = requireAuth();

    if (!in_array($user['role'], $roles, true)) {
        jsonResponse(false, "Forbidden. You do not have permission.", null, 403);
    }

    return $user;
}