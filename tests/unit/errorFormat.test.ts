import { describe, expect, it } from 'vitest';
import { formatErrorChain } from '../../src/core/logging/errorFormat.js';

describe('formatErrorChain', () => {
  it('formats a simple error message', () => {
    const text = formatErrorChain(new Error('boom'));
    expect(text).toContain('boom');
  });

  it('includes nested causes in order', () => {
    const root = new Error('root');
    const mid = new Error('mid', { cause: root });
    const top = new Error('top', { cause: mid });

    const text = formatErrorChain(top);
    expect(text).toContain('top');
    expect(text).toContain('mid');
    expect(text).toContain('root');

    expect(text.indexOf('top')).toBeLessThan(text.indexOf('mid'));
    expect(text.indexOf('mid')).toBeLessThan(text.indexOf('root'));
  });

  it('redacts educoder cookies and auth headers', () => {
    const secretSession = 'session-secret-123';
    const secretTrust = 'trust-secret-456';

    const err = new Error(
      `Cookie: _educoder_session=${secretSession}; autologin_trustie=${secretTrust}; Pc-Authorization: ${secretSession}; payload {"_educoder_session":"${secretSession}","autologin_trustie":"${secretTrust}"}`,
    );

    const text = formatErrorChain(err);

    expect(text).not.toContain(secretSession);
    expect(text).not.toContain(secretTrust);
    expect(text).toContain('_educoder_session=<redacted>');
    expect(text).toContain('autologin_trustie=<redacted>');
  });
});
