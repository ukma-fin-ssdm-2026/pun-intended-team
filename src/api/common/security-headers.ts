// Written with the help of Claude
const SWAGGER_UI_PATH = '/api-docs';

interface Request {
  path: string;
}

interface Response {
  setHeader(name: string, value: string): void;
}

/** Security headers on every response, errors included (OWASP REST Security Cheat Sheet). */
export function securityHeaders(isProduction: boolean) {
  return (req: Request, res: Response, next: () => void): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    // Swagger UI loads its own scripts and styles, which this policy would block.
    if (!req.path.startsWith(SWAGGER_UI_PATH)) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
