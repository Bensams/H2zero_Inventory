<?php

/**
 * Session cookie must allow cross-site requests when the UI (e.g. Vercel) calls the API (e.g. Railway)
 * over HTTPS. Runs before any session_start().
 */
function inventory_configure_session_cookie(): void
{
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    if ($https || getenv('SESSION_SAMESITE_NONE') === '1') {
        session_set_cookie_params([
            'lifetime' => (int) (getenv('SESSION_LIFETIME') ?: 0),
            'path' => '/',
            'domain' => '',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'None',
        ]);
    }
}

inventory_configure_session_cookie();
