<?php
// SERA / YZI Works — Local API Gateway to Node.js Backend Server (Port 4005)
declare(strict_types=1);

$targetHost = "127.0.0.1";
$targetPort = 4005;

// Clean RFC-compliant CORS headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Retell-Signature, X-Razorpay-Signature");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';

// Determine clean destination path
if (isset($_GET['fn'])) {
    $fn = preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['fn']);
    $targetPath = "/.netlify/functions/{$fn}";
} else {
    $targetPath = parse_url($requestUri, PHP_URL_PATH);
}

// Retain query string if present (excluding our internal routing params)
$queryParams = $_GET;
unset($queryParams['fn'], $queryParams['path']);
$queryString = http_build_query($queryParams);

$url = "http://{$targetHost}:{$targetPort}{$targetPath}" . ($queryString ? "?{$queryString}" : '');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$input = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true) ? file_get_contents('php://input') : null;

// Forward incoming request headers
$forwardHeaders = [];
$skipHeaders = ['host', 'content-length', 'connection', 'accept-encoding'];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        if (!in_array(strtolower($name), $skipHeaders, true)) {
            $forwardHeaders[] = "$name: $value";
        }
    }
}
$forwardHeaders[] = 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '');
$forwardHeaders[] = 'Expect:';
if (!empty($_SERVER['CONTENT_TYPE']) && !in_array('content-type', array_map('strtolower', array_keys(getallheaders() ?: [])))) {
    $forwardHeaders[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 90);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

if ($input !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

$responseHeaders = [];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$responseHeaders) {
    $len = strlen($header);
    $parts = explode(':', $header, 2);
    if (count($parts) === 2) {
        $name = strtolower(trim($parts[0]));
        // Avoid duplicating CORS headers and hop-by-hop headers
        if (str_starts_with($name, 'access-control-')) {
            return $len;
        }
        if (!in_array($name, ['transfer-encoding', 'content-encoding', 'connection', 'keep-alive'])) {
            $responseHeaders[] = trim($header);
        }
    }
    return $len;
});

$responseBody = curl_exec($ch);
$httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Auto-recovery: If connection failed (backend down), trigger PM2 in background
if ($httpCode === 0 && $curlError) {
    @exec("export PATH=\$PATH:/home3/veywkomy/.nodejs/bin:/home3/veywkomy/bin; cd /home3/veywkomy/yzi-backend && pm2 start ecosystem.config.cjs >/dev/null 2>&1 &");
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode([
        'ok' => false,
        'error' => 'Sera backend service is initializing. Please retry in 3 seconds.',
        'details' => $curlError
    ]);
    exit;
}

http_response_code($httpCode > 0 ? $httpCode : 200);
foreach ($responseHeaders as $headerLine) {
    header($headerLine, true);
}
echo $responseBody;

