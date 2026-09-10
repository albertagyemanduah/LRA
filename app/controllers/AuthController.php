<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Auth;
use App\Controller;
use App\Flash;
use App\Mailer;
use App\Validator;

final class AuthController extends Controller
{
    public function showLogin(): void
    {
        if ($this->auth->check()) {
            redirect('/dashboard');
        }
        $this->render('auth/login', ['title' => 'Sign in']);
    }

    public function login(): void
    {
        $this->guardCsrf();
        $email = trim((string) input('email', ''));
        $password = (string) input('password', '');

        $v = new Validator($_POST);
        $v->require('email')->email('email')->require('password');
        if ($v->fails()) {
            Flash::error($v->firstError() ?? 'Enter your email and password.');
            redirect('/login');
        }

        $result = $this->auth->attempt($email, $password);
        if (!$result['ok']) {
            Flash::error($result['error'] ?? 'Sign in failed.');
            $_SESSION['_old'] = ['email' => $email];
            redirect('/login');
        }

        $intended = $_SESSION['_intended'] ?? '/dashboard';
        unset($_SESSION['_intended']);
        Flash::success('Welcome back.');
        redirect($intended);
    }

    public function logout(): void
    {
        $this->guardCsrf();
        $this->auth->logout();
        Flash::info('You have been signed out.');
        redirect('/login');
    }

    public function showForgot(): void
    {
        $this->render('auth/forgot', ['title' => 'Reset password']);
    }

    public function forgot(): void
    {
        $this->guardCsrf();
        $email = trim((string) input('email', ''));

        // Always report success — do not reveal whether an account exists.
        $done = static function (): never {
            Flash::success('If that email is registered, a reset link is on its way.');
            redirect('/login');
        };

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $done();
        }
        $user = db_one('SELECT `id`, `name`, `email` FROM `users` WHERE `email` = ?', [$email]);
        if (!$user) {
            $done();
        }

        $token = bin2hex(random_bytes(32));
        db_query('DELETE FROM `password_resets` WHERE `user` = ? AND `usedAt` IS NULL', [$user['id']]);
        db_insert('password_resets', [
            'user'      => $user['id'],
            'tokenHash' => hash('sha256', $token),
            'expiresAt' => date('Y-m-d H:i:s', time() + 3600),
        ]);

        $link = rtrim((string) (getenv('APP_URL') ?: (($_SERVER['REQUEST_SCHEME'] ?? 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost'))), '/')
            . url('/reset-password/' . $token);

        Mailer::send(
            $user['email'],
            'Reset your Land Registry password',
            "<p>Hello " . e($user['name'] ?: 'there') . ",</p>"
            . "<p>We received a request to reset your password. This link is valid for one hour:</p>"
            . "<p><a href=\"" . e($link) . "\">" . e($link) . "</a></p>"
            . "<p>If you did not request this, you can ignore this email.</p>"
        );
        \App\Audit::log('password_reset_requested', 'users', $user['email'], null, $user['id']);
        $done();
    }

    public function showReset(string $token): void
    {
        $row = $this->resetRow($token);
        if (!$row) {
            Flash::error('That reset link is invalid or has expired.');
            redirect('/forgot-password');
        }
        $this->render('auth/reset', ['title' => 'Choose a new password', 'token' => $token]);
    }

    public function reset(): void
    {
        $this->guardCsrf();
        $token = (string) input('token', '');
        $row = $this->resetRow($token);
        if (!$row) {
            Flash::error('That reset link is invalid or has expired.');
            redirect('/forgot-password');
        }

        $v = new Validator($_POST);
        $v->require('password')->min('password', 10)->match('password_confirm', 'password');
        if ($v->fails()) {
            Flash::error($v->firstError() ?? 'Passwords do not match or are too short.');
            redirect('/reset-password/' . $token);
        }

        db_update('users', $row['user'], [
            'password' => password_hash((string) input('password'), PASSWORD_BCRYPT, ['cost' => 10]),
        ]);
        db_update('password_resets', $row['id'], ['usedAt' => date('Y-m-d H:i:s')]);
        db_query('DELETE FROM `user_sessions` WHERE `user` = ?', [$row['user']]);
        \App\Audit::log('password_reset_completed', 'users', '', null, $row['user']);

        Flash::success('Your password has been changed. Please sign in.');
        redirect('/login');
    }

    private function resetRow(string $token): ?array
    {
        if ($token === '') {
            return null;
        }
        return db_one(
            'SELECT * FROM `password_resets`
              WHERE `tokenHash` = ? AND `usedAt` IS NULL AND `expiresAt` > NOW()',
            [hash('sha256', $token)]
        );
    }
}
