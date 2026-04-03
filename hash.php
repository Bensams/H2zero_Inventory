<?php
/**
 * CLI: generate a bcrypt hash for users.password (same algorithm as the API).
 *
 *   php hash.php
 *
 * Edit $plain below, run the script, paste the output into SQL or use bootstrap/signup APIs.
 */
require_once __DIR__ . '/Backend/helpers/password.php';

$plain = 'admin123';
echo auth_password_hash($plain) . PHP_EOL;
