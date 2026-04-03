<?php

header('Content-Type: application/json; charset=UTF-8');

$defaults = 'http://localhost,http://127.0.0.1,http://127.0.0.1:5500,http://localhost:5500';
$raw = getenv('CORS_ALLOWED_ORIGINS');
$allowed = array_values(array_filter(array_map('trim', explode(',', $raw !== false && $raw !== '' ? $raw : $defaults))));

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$originAllowed = $origin !== ''
    && in_array($origin, $allowed, true);

if (!$originAllowed && $origin !== '' && getenv('ALLOW_VERCEL_PREVIEWS') === '1') {
    $host = parse_url($origin, PHP_URL_HOST);
    if (is_string($host) && str_ends_with($host, '.vercel.app') && str_starts_with($origin, 'https://')) {
        $originAllowed = true;
    }
}

if ($originAllowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
