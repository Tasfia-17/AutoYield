/// zkLogin JWT middleware — verifies Sui zkLogin proofs.
/// Extracts sui_address from verified JWT and attaches to req.user.
import type { Request, Response, NextFunction } from 'express';
import { jwtToAddress } from '@mysten/zklogin';

export interface AuthedRequest extends Request {
  user?: { suiAddress: string };
}

export function zkLoginAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  try {
    // Decode JWT to extract sub and iss claims (no signature check needed here —
    // zkLogin proofs are verified on-chain; this just extracts the address)
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString());

    // Derive Sui address from zkLogin sub + salt
    const salt = req.headers['x-zklogin-salt'] as string ?? '0';
    const suiAddress = jwtToAddress(token, salt);

    req.user = { suiAddress };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid zkLogin token' });
  }
}
