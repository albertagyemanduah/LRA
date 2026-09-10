<?php
/**
 * =============================================================
 * CREATE THE FIRST ADMINISTRATOR
 * =============================================================
 * PocketBase's admin UI is gone with the move to MySQL, so this
 * script creates the first account you sign in with. Run it once
 * from the command line:
 *
 *     php database/create-admin.php
 *
 * It prompts for the details and hashes the password with bcrypt
 * (PHP's password_hash), which produces exactly the same hash
 * format PocketBase used and that Node's bcrypt can verify — so
 * accounts work whichever side ends up serving the API.
 *
 * Run it again any time to add another administrator, or pass
 * --super to create a platform Super Admin:
 *
 *     php database/create-admin.php --super
 * =============================================================
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This script may only be run from the command line.\n");
}

require_once __DIR__ . '/connection.php';

/** Read a line from STDIN with a prompt. */
function ask(string $prompt, bool $required = true, string $default = ''): string
{
    while (true) {
        fwrite(STDOUT, $prompt . ($default !== '' ? " [$default]" : '') . ': ');
        $value = trim((string) fgets(STDIN));
        if ($value === '' && $default !== '') {
            return $default;
        }
        if ($value !== '' || !$required) {
            return $value;
        }
        fwrite(STDERR, "  This field is required.\n");
    }
}

/** Read a password without echoing it to the terminal. */
function askSecret(string $prompt): string
{
    fwrite(STDOUT, $prompt . ': ');
    // `stty -echo` is not available on Windows shells; fall back to a
    // visible prompt there rather than failing outright.
    $isWindows = stripos(PHP_OS_FAMILY, 'Windows') !== false;
    if (!$isWindows) {
        shell_exec('stty -echo');
    }
    $value = trim((string) fgets(STDIN));
    if (!$isWindows) {
        shell_exec('stty echo');
        fwrite(STDOUT, "\n");
    }
    return $value;
}

$isSuper = in_array('--super', $argv, true);
$role    = $isSuper ? 'super_admin' : 'admin';

fwrite(STDOUT, "\n=== Create " . ($isSuper ? 'platform Super Admin' : 'workspace Administrator') . " ===\n\n");

// ---- Workspace ----------------------------------------------------
$tenantId = null;
if (!$isSuper) {
    $tenants = db_all('SELECT `id`, `name` FROM `tenants` ORDER BY `name`');
    if ($tenants === []) {
        fwrite(STDERR, "No workspaces exist yet. Import database/seed.sql first.\n");
        exit(1);
    }
    fwrite(STDOUT, "Workspaces:\n");
    foreach ($tenants as $i => $t) {
        fwrite(STDOUT, sprintf("  [%d] %s (%s)\n", $i + 1, $t['name'], $t['id']));
    }
    $choice = (int) ask("\nWorkspace number", true, '1');
    $tenantId = $tenants[$choice - 1]['id'] ?? $tenants[0]['id'];
}

// ---- Details ------------------------------------------------------
$firstName = ask('First name');
$surname   = ask('Surname');
$email     = ask('Email');
$phone     = ask('Phone (optional)', false);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "That is not a valid email address.\n");
    exit(1);
}
if (db_one('SELECT `id` FROM `users` WHERE `email` = ?', [$email])) {
    fwrite(STDERR, "An account with that email already exists.\n");
    exit(1);
}

$password = askSecret('Password (min 10 characters)');
if (strlen($password) < 10) {
    fwrite(STDERR, "Password must be at least 10 characters.\n");
    exit(1);
}
if (askSecret('Confirm password') !== $password) {
    fwrite(STDERR, "Passwords do not match.\n");
    exit(1);
}

// ---- Insert -------------------------------------------------------
$fullName = trim("$firstName $surname");

$id = db_insert('users', [
    'email'           => $email,
    // bcrypt, cost 10 — same format PocketBase produced.
    'password'        => password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]),
    'emailVisibility' => 1,
    'verified'        => 1,
    'name'            => $fullName,
    'fullName'        => $fullName,
    'firstName'       => $firstName,
    'surname'         => $surname,
    'phone'           => $phone,
    'role'            => $role,
    'roles'           => json_encode([$role]),
    'tenant'          => $tenantId,
]);

fwrite(STDOUT, "\n✓ Created {$role}: {$fullName} <{$email}>  (id {$id})\n");
if ($isSuper) {
    fwrite(STDOUT, "  Sign in and open the Platform Console to provision workspaces.\n\n");
} else {
    fwrite(STDOUT, "  Sign in and open Admin → Users to invite the rest of the staff.\n\n");
}
