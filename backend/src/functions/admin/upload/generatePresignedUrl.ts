import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireAdmin } from '../../../utils/adminAuth';
import { success, error } from '../../../utils/response';
import { v4 as uuidv4 } from 'uuid';

const s3Client = new S3Client({ region: 'eu-west-1' });
const BUCKET_NAME = 'rallyehiver-enigmas';
const YEAR = '2025';

/**
 * Generate presigned URL for PDF upload
 * Admin-only endpoint
 * Creates non-guessable filenames using UUID
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.userId;

    if (!userId) {
      return error('Authentication required', 401);
    }

    // Verify admin status
    await requireAdmin(userId);

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { contentType, fileExtension } = body;

    // Validate content type
    if (!contentType || contentType !== 'application/pdf') {
      return error('Only PDF files are allowed', 400);
    }

    // Validate file extension
    if (!fileExtension || fileExtension !== 'pdf') {
      return error('File extension must be .pdf', 400);
    }

    // Generate unique, non-guessable filename
    const uniqueId = uuidv4();
    const fileName = `${uniqueId}.pdf`;
    const fileKey = `${YEAR}/${fileName}`;

    // Create S3 PutObject command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      // Add metadata for tracking
      Metadata: {
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Generate presigned URL valid for 15 minutes
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    // Construct the final public URL (without query params)
    const publicUrl = `https://${BUCKET_NAME}.s3.eu-west-1.amazonaws.com/${fileKey}`;

    return success({
      uploadUrl: presignedUrl,
      fileUrl: publicUrl,
      fileKey: fileKey,
      expiresIn: 900,
      message: 'Upload the PDF using a PUT request to the uploadUrl',
    });
  } catch (err: any) {
    console.error('Generate presigned URL error:', err);

    if (err.message === 'Admin access required') {
      return error('Admin access required', 403);
    }

    return error(err.message || 'Failed to generate upload URL', 500);
  }
};
