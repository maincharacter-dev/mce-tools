import { describe, it, expect } from 'vitest';
import { ENV } from './_core/env';

describe('APS Credentials', () => {
  it('should have APS_CLIENT_ID configured', () => {
    expect(ENV.APS_CLIENT_ID).toBeTruthy();
    expect(ENV.APS_CLIENT_ID.length).toBeGreaterThan(0);
  });

  it('should have APS_CLIENT_SECRET configured', () => {
    expect(ENV.APS_CLIENT_SECRET).toBeTruthy();
    expect(ENV.APS_CLIENT_SECRET.length).toBeGreaterThan(0);
  });

  it('should be able to generate APS OAuth URL', async () => {
    const { getAPSAuthUrl } = await import('./aps');
    const redirectUri = 'http://localhost:3000/api/acc/oauth/callback';
    const authUrl = getAPSAuthUrl(redirectUri);
    
    expect(authUrl).toContain('https://developer.api.autodesk.com/authentication/v2/authorize');
    expect(authUrl).toContain(`client_id=${ENV.APS_CLIENT_ID}`);
    expect(authUrl).toContain('redirect_uri=');
    expect(authUrl).toContain('scope=data%3Aread+data%3Awrite+data%3Acreate+account%3Aread');
  });
});
