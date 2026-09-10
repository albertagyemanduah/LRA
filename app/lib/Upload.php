<?php

declare(strict_types=1);

namespace App;

/**
 * File uploads. Stored on disk at
 *   uploads/<collection>/<recordId>/<random>.<ext>
 * and referenced from the database by file name only — the exact
 * layout the schema notes and apiClient.files.getURL() expect.
 */
final class Upload
{
    private const MIME_BY_EXT = [
        'pdf'  => ['application/pdf'],
        'jpg'  => ['image/jpeg'], 'jpeg' => ['image/jpeg'],
        'png'  => ['image/png'], 'webp' => ['image/webp'], 'gif' => ['image/gif'],
        'doc'  => ['application/msword'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
        'xls'  => ['application/vnd.ms-excel'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
        'csv'  => ['text/csv', 'text/plain', 'application/csv'],
    ];

    /**
     * Move an uploaded file into place and return its stored name.
     * @param array $file  one entry from $_FILES
     * @throws \RuntimeException on any validation failure
     */
    public static function store(array $file, string $collection, string $recordId): string
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new \RuntimeException(self::errorText((int) ($file['error'] ?? 0)));
        }
        $max = $GLOBALS['config']['max_upload_bytes'] ?? 15_728_640;
        if (($file['size'] ?? 0) > $max) {
            throw new \RuntimeException('File is larger than ' . round($max / 1048576) . ' MB.');
        }
        if (!is_uploaded_file($file['tmp_name'])) {
            throw new \RuntimeException('Invalid upload.');
        }

        $ext = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
        $allowed = $GLOBALS['config']['allowed_upload_ext'] ?? [];
        if (!in_array($ext, $allowed, true) || !isset(self::MIME_BY_EXT[$ext])) {
            throw new \RuntimeException("Files of type .$ext are not allowed.");
        }

        $detected = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
        if (!in_array($detected, self::MIME_BY_EXT[$ext], true)) {
            throw new \RuntimeException("The file's contents ($detected) do not match a .$ext file.");
        }

        $dir = rtrim($GLOBALS['config']['upload_dir'], '/\\')
            . DIRECTORY_SEPARATOR . self::safe($collection)
            . DIRECTORY_SEPARATOR . self::safe($recordId);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new \RuntimeException('Could not create the upload directory.');
        }

        $stored = bin2hex(random_bytes(8)) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $stored)) {
            throw new \RuntimeException('Could not save the uploaded file.');
        }
        return $stored;
    }

    /** Remove a stored file (best effort). */
    public static function remove(string $collection, string $recordId, ?string $filename): void
    {
        if (!$filename) {
            return;
        }
        $path = rtrim($GLOBALS['config']['upload_dir'], '/\\')
            . DIRECTORY_SEPARATOR . self::safe($collection)
            . DIRECTORY_SEPARATOR . self::safe($recordId)
            . DIRECTORY_SEPARATOR . basename($filename);
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private static function safe(string $s): string
    {
        return preg_replace('/[^A-Za-z0-9_-]/', '', $s) ?: 'x';
    }

    private static function errorText(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'The file is too large.',
            UPLOAD_ERR_PARTIAL   => 'The file was only partially uploaded.',
            UPLOAD_ERR_NO_FILE   => 'No file was uploaded.',
            UPLOAD_ERR_NO_TMP_DIR => 'Server is missing a temp folder.',
            UPLOAD_ERR_CANT_WRITE => 'Server could not write the file.',
            default => 'The upload failed.',
        };
    }
}
