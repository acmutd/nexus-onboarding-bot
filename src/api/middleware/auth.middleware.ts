import { Request, Response, NextFunction } from 'express';


// Middleware to authenticate API requests using an API key
// The API key should be provided in the Authorization header as "ApiKey <key>"
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  }
  
  // Expected format: "ApiKey <api_key>"
  const [scheme, token] = authHeader.split(' ');
  
  if (scheme !== 'ApiKey' || !token) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: ApiKey <api_key>'
    });
  }
  
  const validApiKey = process.env.API_KEY;
  
  if (!validApiKey) {
    console.error('SECURITY WARNING: API_KEY environment variable is not set!');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API authentication is not properly configured'
    });
  }
  
  if (token !== validApiKey) {
    console.warn(`Failed API authentication attempt from IP: ${req.ip}`);
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }
  
  // Authentication successful
  next();
};
