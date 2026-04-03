<?php
require_once __DIR__ . '/roleMiddleware.php';

function requireAdmin(): array {
    return requireRole(['admin']);
}