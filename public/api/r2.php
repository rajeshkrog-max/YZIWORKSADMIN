<?php
// Cloudflare R2 S3-Compatible Storage Client for YZIServer
declare(strict_types=1);

class CloudflareR2 {
    private string $accessKey;
    private string $secretKey;
    private string $endpoint;
    private string $bucket;
    private string $host;
    private string $region;

    public function __construct(
        ?string $accessKey = null,
        ?string $secretKey = null,
        ?string $endpoint = null,
        ?string $bucket = null
    ) {
        $this->accessKey = $accessKey ?: (getenv('R2_ACCESS_KEY_ID') ?: 'ad51014b2e839d3e83b9bd531f4a1835');
        $this->secretKey = $secretKey ?: (getenv('R2_SECRET_ACCESS_KEY') ?: '263f026c058249c2f4b6b0c9a73f70d7dd451230c5416ad9eb0d2383dd29a0eb');
        $this->endpoint = rtrim($endpoint ?: (getenv('R2_ENDPOINT') ?: 'https://28a24ac59a3cf4d9eb3f47d741bec429.r2.cloudflarestorage.com'), '/');
        $this->bucket = $bucket ?: (getenv('R2_BUCKET_NAME') ?: 'yzi-sera-storage');
        $this->host = parse_url($this->endpoint, PHP_URL_HOST);
        $this->region = 'auto';
    }

    public function putObject(string $key, string $data, string $contentType = 'application/pdf'): array {
        $url = $this->endpoint . '/' . $this->bucket . '/' . ltrim($key, '/');
        $amzdate = gmdate('Ymd\THis\Z');
        $datestamp = gmdate('Ymd');
        $payloadHash = hash('sha256', $data);

        $canonicalHeaders = "host:{$this->host}\nx-amz-content-sha256:{$payloadHash}\nx-amz-date:{$amzdate}\n";
        $signedHeaders = "host;x-amz-content-sha256;x-amz-date";
        $canonicalUri = '/' . $this->bucket . '/' . ltrim($key, '/');
        $canonicalRequest = "PUT\n{$canonicalUri}\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";

        $credentialScope = "{$datestamp}/{$this->region}/s3/aws4_request";
        $stringToSign = "AWS4-HMAC-SHA256\n{$amzdate}\n{$credentialScope}\n" . hash('sha256', $canonicalRequest);

        $kSecret = 'AWS4' . $this->secretKey;
        $kDate = hash_hmac('sha256', $datestamp, $kSecret, true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authHeader = "AWS4-HMAC-SHA256 Credential={$this->accessKey}/{$credentialScope}, SignedHeaders={$signedHeaders}, Signature={$signature}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_POSTFIELDS => $data,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => [
                "Host: {$this->host}",
                "x-amz-date: {$amzdate}",
                "x-amz-content-sha256: {$payloadHash}",
                "Authorization: {$authHeader}",
                "Content-Type: {$contentType}",
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        return [
            'success' => ($httpCode >= 200 && $httpCode < 300),
            'status' => $httpCode,
            'response' => $response,
            'error' => $error,
            'objectKey' => $key,
            'bucket' => $this->bucket,
        ];
    }

    public function getObject(string $key): array {
        $url = $this->endpoint . '/' . $this->bucket . '/' . ltrim($key, '/');
        $amzdate = gmdate('Ymd\THis\Z');
        $datestamp = gmdate('Ymd');
        $payloadHash = hash('sha256', '');

        $canonicalHeaders = "host:{$this->host}\nx-amz-content-sha256:{$payloadHash}\nx-amz-date:{$amzdate}\n";
        $signedHeaders = "host;x-amz-content-sha256;x-amz-date";
        $canonicalUri = '/' . $this->bucket . '/' . ltrim($key, '/');
        $canonicalRequest = "GET\n{$canonicalUri}\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";

        $credentialScope = "{$datestamp}/{$this->region}/s3/aws4_request";
        $stringToSign = "AWS4-HMAC-SHA256\n{$amzdate}\n{$credentialScope}\n" . hash('sha256', $canonicalRequest);

        $kSecret = 'AWS4' . $this->secretKey;
        $kDate = hash_hmac('sha256', $datestamp, $kSecret, true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authHeader = "AWS4-HMAC-SHA256 Credential={$this->accessKey}/{$credentialScope}, SignedHeaders={$signedHeaders}, Signature={$signature}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HTTPHEADER => [
                "Host: {$this->host}",
                "x-amz-date: {$amzdate}",
                "x-amz-content-sha256: {$payloadHash}",
                "Authorization: {$authHeader}",
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        return [
            'success' => ($httpCode === 200),
            'status' => $httpCode,
            'data' => $response,
            'error' => $error,
        ];
    }

    public function getPresignedPutUrl(string $key, string $contentType = 'application/pdf', int $expiresIn = 300): string {
        $amzdate = gmdate('Ymd\THis\Z');
        $datestamp = gmdate('Ymd');
        $credentialScope = "{$datestamp}/{$this->region}/s3/aws4_request";
        $credential = "{$this->accessKey}/{$credentialScope}";

        $query = [
            'X-Amz-Algorithm' => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential' => $credential,
            'X-Amz-Date' => $amzdate,
            'X-Amz-Expires' => (string)$expiresIn,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort($query);
        $canonicalQuery = http_build_query($query);

        $canonicalUri = '/' . $this->bucket . '/' . ltrim($key, '/');
        $canonicalHeaders = "host:{$this->host}\n";
        $signedHeaders = "host";
        $payloadHash = 'UNSIGNED-PAYLOAD';

        $canonicalRequest = "PUT\n{$canonicalUri}\n{$canonicalQuery}\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";
        $stringToSign = "AWS4-HMAC-SHA256\n{$amzdate}\n{$credentialScope}\n" . hash('sha256', $canonicalRequest);

        $kSecret = 'AWS4' . $this->secretKey;
        $kDate = hash_hmac('sha256', $datestamp, $kSecret, true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $query['X-Amz-Signature'] = $signature;
        return $this->endpoint . $canonicalUri . '?' . http_build_query($query);
    }
}
