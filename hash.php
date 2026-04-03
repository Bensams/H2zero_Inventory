<?php
/**
 * Generate a bcrypt hash for the database `users.password` column.
 *
 * Change $plain below to your desired password, run: php hash.php
 * Log in with that exact string (no $ prefix unless it is part of your password).
 */
$plain = 'admin123';
echo password_hash($plain, PASSWORD_DEFAULT);
