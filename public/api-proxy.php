<?php
// SERA / YZI Works — Server API Gateway & Cloudflare R2 Native Handler
declare(strict_types=1);

// Load environment from api/.env if present
$apiEnv = __DIR__ . '/api/.env';
if (file_exists($apiEnv)) {
    $lines = file($apiEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines) {
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) continue;
            if (str_contains($line, '=')) {
                [$k, $v] = explode('=', $line, 2);
                $k = trim($k);
                $v = trim(trim($v), "\"'");
                putenv("$k=$v");
                $_ENV[$k] = $v;
                $_SERVER[$k] = $v;
            }
        }
    }
}

// Require R2 client
require_once __DIR__ . '/api/r2.php';

// CORS support
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$fn = isset($_GET['fn']) ? $_GET['fn'] : '';
$fn = preg_replace('/[^a-zA-Z0-9_\-]/', '', $fn);

if (empty($fn)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'No function specified']);
    exit;
}

$r2 = new CloudflareR2();

// 1. Native handler for sera-create-upload
if ($fn === 'sera-create-upload') {
    header('Content-Type: application/json');

    // Case A: Direct file upload via multipart/form-data
    if (!empty($_FILES['file'])) {
        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'File upload error code: ' . $file['error']]);
            exit;
        }

        $filename = $file['name'] ?? 'resume.pdf';
        $size = (int)($file['size'] ?? 0);

        if (!preg_match('/\.pdf$/i', $filename)) {
            http_response_code(400);
            echo json_encode(['error' => 'Only PDF résumés are accepted']);
            exit;
        }

        if ($size > 10 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'File must be a PDF up to 10 MB']);
            exit;
        }

        $pdfBytes = file_get_contents($file['tmp_name']);
        if ($pdfBytes === false || strlen($pdfBytes) === 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Unable to read uploaded file']);
            exit;
        }

        $uuid = bin2hex(random_bytes(16));
        $objectKey = "sera-interviews/{$uuid}.pdf";

        $res = $r2->putObject($objectKey, $pdfBytes, 'application/pdf');

        if (!$res['success']) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to store resume in Cloudflare R2', 'details' => $res['error']]);
            exit;
        }

        echo json_encode([
            'success' => true,
            'objectKey' => $objectKey,
            'filename' => $filename,
            'size' => $size,
        ]);
        exit;
    }

    // Case B: JSON request for presigned upload URL or base64 payload
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: [];

    if (!empty($body['fileBase64'])) {
        $pdfBytes = base64_decode($body['fileBase64']);
        $uuid = bin2hex(random_bytes(16));
        $objectKey = "sera-interviews/{$uuid}.pdf";
        $res = $r2->putObject($objectKey, $pdfBytes, 'application/pdf');
        if ($res['success']) {
            echo json_encode([
                'success' => true,
                'objectKey' => $objectKey,
                'filename' => $body['filename'] ?? 'resume.pdf',
            ]);
            exit;
        }
    }

    $filename = $body['filename'] ?? '';
    $size = (int)($body['size'] ?? 0);

    if (empty($filename) || !preg_match('/\.pdf$/i', $filename)) {
        http_response_code(400);
        echo json_encode(['error' => 'Only PDF résumés are accepted']);
        exit;
    }

    $uuid = bin2hex(random_bytes(16));
    $objectKey = "sera-interviews/{$uuid}.pdf";
    $uploadUrl = $r2->getPresignedPutUrl($objectKey, 'application/pdf', 300);

    echo json_encode([
        'success' => true,
        'uploadUrl' => $uploadUrl,
        'objectKey' => $objectKey,
        'expiresIn' => 300,
    ]);
    exit;
}

// 2. Native handler for sera-extract-resume
if ($fn === 'sera-extract-resume') {
    header('Content-Type: application/json');

    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: [];
    $objectKey = $body['objectKey'] ?? '';

    if (empty($objectKey) || !str_starts_with($objectKey, 'sera-interviews/')) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid attachment location']);
        exit;
    }

    $res = $r2->getObject($objectKey);
    if (!$res['success'] || empty($res['data'])) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to fetch résumé from Cloudflare R2 storage']);
        exit;
    }

    $pdfData = $res['data'];

    // Helper: Extract text from PDF binary streams
    function parsePdfText(string $pdfData): string {
        $text = '';
        if (preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $pdfData, $matches)) {
            foreach ($matches[1] as $stream) {
                $decompressed = @gzuncompress($stream);
                if ($decompressed === false) {
                    $decompressed = $stream;
                }
                if (preg_match_all('/\((.*?)\)\s*Tj/s', $decompressed, $tjMatches)) {
                    foreach ($tjMatches[1] as $t) {
                        $text .= $t . ' ';
                    }
                }
                if (preg_match_all('/\[(.*?)\]\s*TJ/s', $decompressed, $tjArrMatches)) {
                    foreach ($tjArrMatches[1] as $arr) {
                        if (preg_match_all('/\((.*?)\)/s', $arr, $inner)) {
                            foreach ($inner[1] as $t) {
                                $text .= $t;
                            }
                            $text .= ' ';
                        }
                    }
                }
            }
        }
        $text = str_replace(['\\(', '\\)', '\\\\'], ['(', ')', '\\'], $text);
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }

    $extractedText = parsePdfText($pdfData);

    // Fallback if compressed in a different manner
    if (strlen($extractedText) < 30) {
        $clean = preg_replace('/[^\x20-\x7E\r\n\t]/', ' ', $pdfData);
        $clean = preg_replace('/\s+/', ' ', $clean);
        if (preg_match_all('/[a-zA-Z0-9,.\-@ ]{15,}/', $clean, $m)) {
            $extractedText = implode(' ', $m[0]);
        }
    }

    if (strlen($extractedText) < 50) {
        echo json_encode([
            'valid' => false,
            'reason' => "This PDF doesn't have enough readable text — please upload your actual résumé.",
        ]);
        exit;
    }

    // Extract candidate first name
    $firstName = null;
    $words = explode(' ', trim($extractedText));
    $ignoredWords = ['resume', 'curriculum', 'vitae', 'cv', 'profile', 'contact', 'email', 'phone', 'page'];
    foreach ($words as $w) {
        $cleanW = trim(preg_replace('/[^a-zA-Z]/', '', $w));
        if (strlen($cleanW) >= 3 && !in_array(strtolower($cleanW), $ignoredWords)) {
            $firstName = ucfirst(strtolower($cleanW));
            break;
        }
    }

    // Determine field from common domain keywords
    $lower = strtolower($extractedText);
    $field = 'technology';
    if (str_contains($lower, 'frontend') || str_contains($lower, 'react') || str_contains($lower, 'ui/ux') || str_contains($lower, 'web developer')) {
        $field = 'frontend engineering';
    } elseif (str_contains($lower, 'backend') || str_contains($lower, 'node') || str_contains($lower, 'python') || str_contains($lower, 'sql') || str_contains($lower, 'api')) {
        $field = 'backend engineering';
    } elseif (str_contains($lower, 'data') || str_contains($lower, 'analytics') || str_contains($lower, 'machine learning')) {
        $field = 'data analytics';
    } elseif (str_contains($lower, 'design') || str_contains($lower, 'graphic') || str_contains($lower, 'figma')) {
        $field = 'product design';
    } elseif (str_contains($lower, 'sales') || str_contains($lower, 'marketing') || str_contains($lower, 'growth')) {
        $field = 'growth & sales';
    } elseif (str_contains($lower, 'finance') || str_contains($lower, 'accounting') || str_contains($lower, 'audit')) {
        $field = 'finance';
    }

    $highlight = "Strong hands-on experience in {$field} with demonstrated problem-solving skills.";
    $safeText = substr($extractedText, 0, 12000);

    echo json_encode([
        'valid' => true,
        'resumeText' => $safeText,
        'highlight' => $highlight,
        'field' => $field,
        'candidateFirstName' => $firstName,
    ]);
    exit;
}

// 3. Fallback: Proxy any other functions to deployed Netlify backend
$targetBase = 'https://yziworks.netlify.app/.netlify/functions/';
$url = $targetBase . $fn;

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

if (in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PUT', 'PATCH'])) {
    $input = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

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
