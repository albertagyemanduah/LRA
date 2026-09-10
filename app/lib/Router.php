<?php

declare(strict_types=1);

namespace App;

/**
 * Tiny path router. Routes are registered as
 *   $r->get('/parcels/{id}', [ParcelController::class, 'show']);
 * Placeholders match a single path segment and are passed to the
 * handler in order, after the Request-ish context array.
 */
final class Router
{
    /** @var array<int, array{method:string, regex:string, params:string[], handler:callable|array}> */
    private array $routes = [];

    public function get(string $path, $handler): void    { $this->add('GET', $path, $handler); }
    public function post(string $path, $handler): void   { $this->add('POST', $path, $handler); }
    public function any(string $path, $handler): void     { $this->add('ANY', $path, $handler); }

    private function add(string $method, string $path, $handler): void
    {
        $params = [];
        $regex = preg_replace_callback('/\{([a-zA-Z_]+)\}/', static function ($m) use (&$params) {
            $params[] = $m[1];
            return '([^/]+)';
        }, $path);
        $this->routes[] = [
            'method' => $method,
            'regex'  => '#^' . rtrim($regex, '/') . '/?$#',
            'params' => $params,
            'handler' => $handler,
        ];
    }

    /** Dispatch the current request. */
    public function dispatch(string $method, string $path): void
    {
        $path = '/' . trim($path, '/');
        $allowedButWrongMethod = false;

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $path, $m)) {
                continue;
            }
            if ($route['method'] !== 'ANY' && $route['method'] !== $method) {
                $allowedButWrongMethod = true;
                continue;
            }
            array_shift($m);
            $this->invoke($route['handler'], $m);
            return;
        }

        http_response_code($allowedButWrongMethod ? 405 : 404);
        $code = $allowedButWrongMethod ? 405 : 404;
        if (function_exists('render')) {
            render('errors/generic', [
                'title' => $code === 405 ? 'Method not allowed' : 'Page not found',
                'code'  => $code,
                'message' => $code === 405
                    ? 'That action cannot be reached this way.'
                    : "We couldn't find the page you were looking for.",
            ]);
        }
        echo "Error $code";
    }

    private function invoke($handler, array $args): void
    {
        if (is_array($handler)) {
            [$class, $method] = $handler;
            if (!class_exists($class)) {
                http_response_code(503);
                render('errors/generic', [
                    'title' => 'Module not available yet',
                    'code' => 503,
                    'message' => 'This section is part of the platform but has not been enabled in this build.',
                ]);
            }
            $handler = [new $class(), $method];
        }
        $handler(...$args);
    }
}
