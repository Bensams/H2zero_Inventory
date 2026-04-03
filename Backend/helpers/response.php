<?php
function jsonResponse(bool $success, string $message, $data = null, int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode([
        "success" => $success,
        "message" => $message,
        "data" => $data
    ]);
    exit;
}