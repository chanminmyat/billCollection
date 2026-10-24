/** Customer-facing receipt print layout. Keep customer data escaped in the caller. */
export const RECEIPT_PRINT_STYLES = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f4f4f5; color: #18181b; font: 12px/1.6 Arial, sans-serif; }
  .page { max-width: 900px; margin: 0 auto; padding: 36px; background: #fff; border: 1px solid #d4d4d8; border-top: 3px solid #18181b; border-radius: 12px; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 28px; padding-bottom: 24px; border-bottom: 1px solid #f4f4f5; }
  .company-header { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
  .company-logo { width: 52px; height: 52px; flex: 0 0 52px; object-fit: contain; border-radius: 8px; }
  .company-meta { color: #18181b; font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
  .company-name { margin-bottom: 4px; color: #18181b; font-size: 16px; font-weight: 700; }
  .receipt-heading { min-width: 150px; text-align: right; }
  .eyebrow { color: #18181b; font-size: 32px; line-height: 1.2; font-weight: 600; letter-spacing: -1px; }
  .receipt-no { margin-top: 10px; color: #18181b; font-family: monospace; font-size: 11px; overflow-wrap: anywhere; }
  .issued { margin-top: 4px; color: #18181b; font-size: 11px; }
  .status { display: inline-block; margin-top: 8px; padding: 3px 9px; border: 1px solid #d4d4d8; border-radius: 20px; color: #18181b; font-size: 10px; font-weight: 700; text-transform: capitalize; }
  .status.unpaid { color: #18181b; border-color: #71717a; }
  .status.overdue { color: #18181b; border-color: #71717a; }
  .status.cancelled { color: #18181b; border-color: #71717a; }
  .amount-band { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 24px; padding: 16px 18px; border: 1px solid #d4d4d8; border-radius: 10px; background: #f4f4f5; }
  .amount-label { font-size: 11px; font-weight: 700; color: #18181b; }
  .amount { font-size: 24px; line-height: 1.3; font-weight: 700; color: #18181b; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  /* The masthead and payment strip form one distinctive ISP receipt identity. */
  .page { border: 1px solid #d4d4d8; border-radius: 4px; padding: 0; overflow: hidden; }
  .masthead { padding: 24px 28px 22px; background: #fff; border-bottom: 1px solid #d4d4d8; color: #18181b; }
  .company-header { flex: 1; }
  .company-meta { color: #71717a; }
  .company-name { color: #18181b; font-size: 17px; }
  .receipt-heading { min-width: 225px; flex: 0 0 225px; }
  .service-label { color: #71717a; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .eyebrow { color: #18181b; margin-top: 7px; font-size: 24px; letter-spacing: -.6px; }
  .receipt-no, .issued { color: #71717a; }
  .status { color: #71717a; border-color: #71717a; }
  .status.cancelled { color: #71717a; border-color: #71717a; }
  .amount-band { margin: 0; border: 0; border-bottom: 1px solid #d4d4d8; border-radius: 0; padding: 16px 28px; background: #f4f4f5; }
  .amount { flex: 0 0 auto; white-space: nowrap; font-size: 26px; letter-spacing: -.7px; }
  .content { padding: 0 28px 20px; }
  .section { margin-top: 24px; line-height: 1.7; }
  .title { margin-bottom: 10px; color: #18181b; font-size: 10px; letter-spacing: .8px; font-weight: 700; text-transform: uppercase; break-after: avoid; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .receipt-grid { grid-template-columns: 1fr 1fr 1.2fr; gap: 20px; }
  .info-card { min-width: 0; break-inside: avoid; overflow-wrap: anywhere; }
  .info-card div + div { margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { padding: 10px 8px; background: #f4f4f5; border-top: 1px solid #d4d4d8; border-bottom: 1px solid #d4d4d8; color: #18181b; text-align: left; font-size: 10px; font-weight: 700; }
  td { padding: 10px 8px; border-bottom: 1px solid #f4f4f5; vertical-align: top; overflow-wrap: anywhere; }
  .right { text-align: right; white-space: nowrap; }
  th:nth-child(n+3) { text-align: right; }
  td:nth-child(2) { padding-right: 14px; }
  .bold { font-weight: 700; }
  .total { padding-top: 15px; color: #18181b; background: #f4f4f5; font-size: 14px; font-weight: 700; border-top: 1px solid #d4d4d8; }
  .calculation { padding: 16px; border: 1px solid #d4d4d8; border-radius: 10px; }
  .totals { margin-top: 12px; text-align: right; }
  .due { margin-top: 5px; color: #18181b; font-weight: 700; }
  .payment-card { padding: 16px; border: 1px solid #d4d4d8; border-radius: 10px; break-inside: avoid; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; }
  .footer { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: start; margin-top: 30px; padding-top: 16px; border-top: 1px solid #d4d4d8; color: #18181b; font-size: 10px; break-inside: avoid; }
  .thank-you { margin-bottom: 8px; color: #18181b; font-size: 14px; font-weight: 600; }
  .receipt-signoff { margin-top: 6px; color: #18181b; font-size: 10px; font-weight: 400; }
  .terms strong { display: block; margin-bottom: 4px; color: #18181b; font-size: 10px; }
  @media screen and (max-width: 640px) { body { padding: 12px; } .page { padding: 0; } .masthead { padding: 24px; } .content { padding: 0 20px 24px; } .amount-band { padding: 18px 20px; } .masthead { flex-direction: column; } .receipt-heading { text-align: left; } .grid, .receipt-grid { grid-template-columns: 1fr; gap: 18px; } .amount-band { flex-wrap: wrap; } .footer { grid-template-columns: 1fr; } }
  @media print { body { font-size: 11px; line-height: 1.5; } .section { line-height: 1.5; } th, td { padding: 6px 8px; } .section { margin-top: 16px; } .payment-card { padding: 12px; } .title { margin-bottom: 7px; } .footer { margin-top: 20px; padding-top: 12px; } body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .page { max-width: none; margin: 0; padding: 0; border: 1px solid #d4d4d8; border-radius: 0; overflow: visible; } a { color: inherit; text-decoration: none; } }
`;

/** Wait for document assets so logos do not disappear from a fast print request. */
export async function renderReceiptPrintWindow(target: Window, html: string) {
  if (target.closed) return;
  target.document.open();
  target.document.write(html);
  target.document.close();
  const images = Array.from(target.document.images).map((image) =>
    image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }),
  );
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.all([...images, target.document.fonts?.ready]),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 3000);
      }),
    ]);
    if (!target.closed) {
      target.focus();
      target.print();
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
