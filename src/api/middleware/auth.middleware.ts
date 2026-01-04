import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Middleware to authenticate API requests using Firebase Auth tokens
// The Firebase ID token should be provided in the Authorization header as "Bearer <token>"

// This verifies that requests come from authenticated users in your Firebase project.
export const authenticateFirebaseUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  }
  
  // Expected format: "Bearer <firebase_id_token>"
  const [bearer, token] = authHeader.split(' ');
  
  if (bearer !== 'Bearer' || !token) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected: Bearer <firebase_id_token>'
    });
  }
  
  try {
    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Attach user info to request for use in controllers
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };
    
    console.log(`✓ Authenticated user: ${decodedToken.email || decodedToken.uid}`);
    
    // Authentication successful
    next();
  } catch (error) {
    console.warn(`Failed Firebase auth attempt from IP ${req.ip}:`, error instanceof Error ? error.message : 'Unknown error');
    return res.status(403).json({ 
      error: 'Forbidden',
      message: 'Invalid or expired Firebase token'
    });
  }
};

/**
 * Legacy API key authentication - kept for backward compatibility
 * Will be deprecated in future versions
 */
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
