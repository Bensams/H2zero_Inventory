<?php
function getJsonInput(): array {
    $input = json_decode(file_get_contents("php://input"), true);
    return is_array($input) ? $input : [];
}

function getRequestMethod(): string {
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function getQueryParam(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}

function writeLog(string $message): void {
    $line = "[" . date("Y-m-d H:i:s") . "] " . $message . PHP_EOL;
    file_put_contents(LOG_FILE, $line, FILE_APPEND);
}