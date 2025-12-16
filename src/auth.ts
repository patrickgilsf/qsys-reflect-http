import puppeteer, { Browser, Page } from 'puppeteer';

export interface AuthResult {
  token: string;
  expiresAt?: Date;
}

export interface AuthConfig {
  email: string;
  password: string;
  headless?: boolean;
  timeout?: number;
}

/**
 * Authenticates with Q-SYS Reflect using Puppeteer to handle the Azure AD B2C flow.
 * Returns a bearer token for API calls.
 */
export default async function authenticate(config: AuthConfig): Promise<AuthResult> {
  const { email, password, headless = true, timeout = 60000 } = config;

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);

    let capturedToken: string | null = null;

    // Intercept network responses to capture the auth token
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/v0/users/auth/provider') && response.request().method() === 'POST') {
        try {
          const json = await response.json();
          if (json.token) {
            capturedToken = json.token;
          }
        } catch {
          // Response may not be JSON, ignore
        }
      }
    });

    // Navigate to Reflect
    await page.goto('https://reflect.qsc.com', { waitUntil: 'networkidle2' });

    // Click the "Sign in with QSC Account" button
    await page.waitForSelector('a[name="signInWithQscId"], a.login-button___WBrkj', {
      timeout: 30000,
    });
    await Promise.all([
      page.click('a[name="signInWithQscId"], a.login-button___WBrkj'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    // Step 1: Email input page
    await page.waitForSelector('input[name="email"]', { timeout: 30000 });
    await page.type('input[name="email"]', email, { delay: 50 });
    await Promise.all([
      page.click('#handleSignIn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    ]);

    // Step 2: Password input page
    await page.waitForSelector('input[name="password"]', { timeout: 30000 });
    await page.type('input[name="password"]', password, { delay: 50 });
    await Promise.all([
      page.click('#handleSignIn'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    ]);

    // Wait for redirect back to Reflect
    await page.waitForFunction(
      `window.location.hostname === 'reflect.qsc.com' && !window.location.pathname.includes('/auth')`,
      { timeout: 30000 }
    );
    await delay(2000);

    // Try localStorage if not captured via network
    if (!capturedToken) {
      capturedToken = await page.evaluate(() => {
        return localStorage.getItem('token') 
          || localStorage.getItem('access_token')
          || localStorage.getItem('auth_token');
      });
    }

    // Try sessionStorage as fallback
    if (!capturedToken) {
      capturedToken = await page.evaluate(() => {
        return sessionStorage.getItem('token') || sessionStorage.getItem('access_token');
      });
    }

    if (!capturedToken) {
      throw new Error('Failed to capture authentication token');
    }

    return { token: capturedToken };

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


