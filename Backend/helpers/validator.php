<?php
function requireFields(array $data, array $fields): array {
    $missing = [];

    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
            $missing[] = $field;
        }
    }

    return $missing;
}

function isValidRole(string $role): bool {
    return in_array($role, ['admin', 'staff'], true);
}

function isValidGmail(string $email): bool {
    return filter_var($email, FILTER_VALIDATE_EMAIL) &&
           str_ends_with(strtolower($email), '@gmail.com');
}