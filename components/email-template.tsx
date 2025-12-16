import * as React from 'react';

type EmailTemplateProps = {
  email: string;
  resetLink: string;
};

export function EmailTemplate({ email, resetLink }: EmailTemplateProps) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset Your Password</title>
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          backgroundColor: '#f4f4f5',
        }}
      >
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#f4f4f5', padding: '40px 0' }}>
          <tbody>
            <tr>
              <td align="center">
                <table
                  width="600"
                  cellPadding={0}
                  cellSpacing={0}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: '40px 40px 20px', textAlign: 'center' }}>
                        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#18181b' }}>Reset Your Password</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0 40px 30px' }}>
                        <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: '24px', color: '#52525b' }}>Hi there,</p>
                        <p style={{ margin: '0 0 20px', fontSize: 16, lineHeight: '24px', color: '#52525b' }}>
                          We received a request to reset the password for your account (<strong>{email}</strong>).
                        </p>
                        <p style={{ margin: '0 0 30px', fontSize: 16, lineHeight: '24px', color: '#52525b' }}>
                          Click the button below to reset your password:
                        </p>
                        <table width="100%" cellPadding={0} cellSpacing={0}>
                          <tbody>
                            <tr>
                              <td align="center" style={{ padding: '0 0 30px' }}>
                                <a
                                  href={resetLink}
                                  style={{
                                    display: 'inline-block',
                                    padding: '14px 32px',
                                    backgroundColor: '#18181b',
                                    color: '#ffffff',
                                    textDecoration: 'none',
                                    borderRadius: 6,
                                    fontSize: 16,
                                    fontWeight: 500,
                                  }}
                                >
                                  Reset Password
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: '20px', color: '#71717a' }}>
                          Or copy and paste this link into your browser:
                        </p>
                        <p
                          style={{
                            margin: '0 0 30px',
                            fontSize: 14,
                            lineHeight: '20px',
                            color: '#3b82f6',
                            wordBreak: 'break-all',
                          }}
                        >
                          {resetLink}
                        </p>
                        <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: '20px', color: '#71717a' }}>
                          This link will expire in 1 hour for security reasons.
                        </p>
                        <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#71717a' }}>
                          If you didn&apos;t request a password reset, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '30px 40px 40px', borderTop: '1px solid #e4e4e7' }}>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: '18px', color: '#a1a1aa', textAlign: 'center' }}>
                          This is an automated message, please do not reply to this email.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
