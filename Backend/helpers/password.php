<?php

/**
 * Bcrypt-only for new hashes (PASSWORD_BCRYPT, cost 12).
 * Verification still accepts older bcrypt hashes (e.g. previous PASSWORD_DEFAULT).
 */

function auth_password_hash(string $plain): string
{
    return password_hash($plain, PASSWORD_BCRYPT, ['cost' => 12]);
}

/**
 * Returns the plaintext that matched the hash, or null.
 * Tolerates an extra leading "$" on input when the stored hash was for the string without it.
 */
function auth_plain_that_verified(string $plain, string $storedHash): ?string
{
    if ($plain === '' || $storedHash === '') {
        return null;
    }

    $candidates = [$plain];
    if (strlen($plain) > 1 && $plain[0] === '$') {
        $candidates[] = substr($plain, 1);
    }

    foreach ($candidates as $try) {
        if (password_verify($try, $storedHash)) {
            return $try;
        }
    }

    return null;
}

function auth_password_verify(string $plain, string $storedHash): bool
{
    return auth_plain_that_verified($plain, $storedHash) !== null;
}

function auth_password_needs_rehash(string $storedHash): bool
{
    return password_needs_rehash($storedHash, PASSWORD_BCRYPT, ['cost' => 12]);
}
