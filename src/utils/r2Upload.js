const R2_CREATE_UPLOAD_ENDPOINT =
  '/.netlify/functions/r2-create-upload'

const MAX_FILES = 5
const MAX_TOTAL_SIZE = 20 * 1024 * 1024

export async function uploadFilesToR2(files, applicationType) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Please select at least one file')
  }

  if (files.length > MAX_FILES) {
    throw new Error(`You can upload a maximum of ${MAX_FILES} files`)
  }

  if (!['builder', 'partner'].includes(applicationType)) {
    throw new Error('Invalid application type')
  }

  const totalSize = files.reduce(
    (total, file) => total + file.size,
    0
  )

  if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error('Total file size must be 20 MB or smaller')
  }

  const prepareResponse = await fetch(
    R2_CREATE_UPLOAD_ENDPOINT,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicationType,
        files: files.map(file => ({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size
        }))
      })
    }
  )

  const prepareResult = await prepareResponse.json()

  if (
    !prepareResponse.ok ||
    !prepareResult.success ||
    !Array.isArray(prepareResult.uploads)
  ) {
    throw new Error(
      prepareResult.error || 'Unable to prepare file uploads'
    )
  }

  if (prepareResult.uploads.length !== files.length) {
    throw new Error('Upload preparation returned an invalid file count')
  }

  const uploadedFiles = await Promise.all(
    files.map(async (file, index) => {
      const upload = prepareResult.uploads[index]

      const uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type':
            file.type || 'application/octet-stream'
        },
        body: file
      })

      if (!uploadResponse.ok) {
        throw new Error(
          `Upload failed for ${file.name} (${uploadResponse.status})`
        )
      }

      return {
        objectKey: upload.objectKey,
        originalFilename: file.name,
        contentType:
          file.type || 'application/octet-stream',
        size: file.size
      }
    })
  )

  return uploadedFiles
}