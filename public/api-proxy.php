<?php
// Bridge requests from /.netlify/functions/* to the deployed Netlify backend
$targetBase = 'https://yziworks.netlify.app/.netlify/functions/';
$fn = isset($_GET['fn']) ? $_GET['fn'] : '';

// Sanitize function name
$fn = preg_replace('/[^a-zA-Z0-9_\-]/', '', $fn);
if (empty($fn)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No function specified']);
    exit;
}

$url = $targetBase . $fn;

// Forward query parameters if any (excluding internal 'fn')
$params = $_GET;
unset($params['fn']);
if (!empty($params)) {
    $url .= '?' . http_build_query($params);
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

// Forward request headers
$forwardHeaders = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        $lower = strtolower($name);
        if (!in_array($lower, ['host', 'content-length', 'connection', 'accept-encoding'])) {
            $forwardHeaders[] = "$name: $value";
        }
    }
}
$forwardHeaders[] = 'X-Forwarded-For: ' . ($_SERVER['REMOTE_ADDR'] ?? '');
curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

// Forward request body for POST/PUT/PATCH
if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH'])) {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

// Capture response headers
$responseHeaders = [];
curl_setopt($ch, CURLOPT_HEADERFUNCTION, function($curl, $header) use (&$responseHeaders) {
    $len = strlen($header);
    $parts = explode(':', $header, 2);
    if (count($parts) === 2) {
        $name = strtolower(trim($parts[0]));
        if (!in_array($name, ['transfer-encoding', 'content-encoding', 'connection'])) {
            $responseHeaders[] = trim($header);
        }
    }
    return $len;
});

$responseBody = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError && empty($responseBody)) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API proxy gateway error', 'details' => $curlError]);
    exit;
}

http_response_code($httpCode ? $httpCode : 200);
foreach ($responseHeaders as $headerLine) {
    header($headerLine, false);
}
echo $responseBody;
