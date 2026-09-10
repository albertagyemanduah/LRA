<?php

declare(strict_types=1);

namespace App;

/**
 * Minimal form validator.
 *
 *   $v = new Validator($_POST);
 *   $v->require('email')->email('email')->min('password', 10);
 *   if ($v->fails()) { ... $v->errors() ... }
 */
final class Validator
{
    /** @var array<string, string> */
    private array $errors = [];

    public function __construct(private array $data)
    {
    }

    public function value(string $field): mixed
    {
        return $this->data[$field] ?? null;
    }

    private function val(string $field): string
    {
        return trim((string) ($this->data[$field] ?? ''));
    }

    public function require(string $field, ?string $label = null): self
    {
        if ($this->val($field) === '') {
            $this->add($field, ($label ?? humanize($field)) . ' is required.');
        }
        return $this;
    }

    public function requireAll(array $fields): self
    {
        foreach ($fields as $f) {
            $this->require($f);
        }
        return $this;
    }

    public function email(string $field): self
    {
        $v = $this->val($field);
        if ($v !== '' && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $this->add($field, humanize($field) . ' must be a valid email address.');
        }
        return $this;
    }

    public function min(string $field, int $len): self
    {
        if (mb_strlen($this->val($field)) < $len && $this->val($field) !== '') {
            $this->add($field, humanize($field) . " must be at least $len characters.");
        }
        return $this;
    }

    public function in(string $field, array $allowed): self
    {
        $v = $this->val($field);
        if ($v !== '' && !in_array($v, $allowed, true)) {
            $this->add($field, humanize($field) . ' is not a valid choice.');
        }
        return $this;
    }

    public function numeric(string $field): self
    {
        $v = $this->val($field);
        if ($v !== '' && !is_numeric($v)) {
            $this->add($field, humanize($field) . ' must be a number.');
        }
        return $this;
    }

    public function match(string $field, string $other): self
    {
        if ($this->val($field) !== $this->val($other)) {
            $this->add($field, humanize($field) . ' does not match.');
        }
        return $this;
    }

    public function add(string $field, string $message): void
    {
        $this->errors[$field] ??= $message;
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    public function passes(): bool
    {
        return $this->errors === [];
    }

    /** @return array<string, string> */
    public function errors(): array
    {
        return $this->errors;
    }

    public function firstError(): ?string
    {
        return $this->errors ? reset($this->errors) : null;
    }
}
