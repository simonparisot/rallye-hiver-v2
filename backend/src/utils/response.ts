export function successResponse(data: any, statusCode: number = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(data),
  };
}

export function errorResponse(message: string, statusCode: number = 400) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify({ error: message }),
  };
}

// Aliases for convenience
export const success = successResponse;
export const error = errorResponse;
