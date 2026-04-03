<?php
require_once __DIR__ . '/../helpers/session.php';
require_once __DIR__ . '/../helpers/response.php';

function requireAuth(): array {
    $user = getCurrentUser();

    if (!$user) {
        jsonResponse(false, "Unauthorized. Please login first.", null, 401);
    }

    return $user;
}