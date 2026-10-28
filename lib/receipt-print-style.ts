/** Customer-facing receipt print layout. Keep customer data escaped in the caller. */
export const RECEIPT_PRINT_STYLES = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; background: #f5f5f5; color: #222; font: 12px/1.6 Arial, sans-serif; }
  .page { max-width: 850px; margin: auto; padding: 40px; background: white; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; padding-bottom: 28px; border-bottom: 1px solid #242424; }
  .company-header { display: flex; flex: 1; gap: 14px; min-width: 0; }
  .company-logo { width: 46px; height: 46px; flex: 0 0 46px; object-fit: contain; }
  .company-meta { color: #666; font-size: 10px; line-height: 1.7; overflow-wrap: anywhere; }
  .company-name { margin-bottom: 7px; color: #222; font-size: 17px; font-weight: 700; line-height: 1.4; }
  .receipt-heading { flex: 0 0 190px; min-width: 0; text-align: right; }
  .service-label { color: #666; font-size: 8px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; }
  .eyebrow { margin-top: 6px; font-size: 34px; line-height: 1.2; font-weight: 400; letter-spacing: -1px; }
  .receipt-no { margin-top: 10px; font: 10px/1.6 monospace; overflow-wrap: anywhere; }
  .issued { margin-top: 3px; color: #666; font-size: 10px; }
  .status { display: inline-block; margin-top: 9px; padding: 2px 8px; border: 1px solid #ccc; color: #444; font-size: 9px; text-transform: capitalize; }
  .status.cancelled { border: 2px solid #444; font-weight: 700; }
  .section { margin-top: 26px; }
  .title { margin-bottom: 10px; color: #777; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; break-after: avoid; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .receipt-grid { grid-template-columns: 1.1fr 1.1fr 1fr; gap: 24px; }
  .info-card { min-width: 0; break-inside: avoid; overflow-wrap: anywhere; }
  .info-card div + div { margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { padding: 10px 7px; border-top: 1px solid #333; border-bottom: 1px solid #ccc; color: #666; font-size: 9px; font-weight: 600; text-align: left; }
  td { padding: 12px 7px; border-bottom: 1px solid #eee; vertical-align: top; overflow-wrap: anywhere; }
  .right { text-align: right; white-space: nowrap; }
  th:nth-child(n+3) { text-align: right; }
  td:nth-child(2) { padding-right: 14px; }
  .bold { font-weight: 700; }
  .total { padding: 20px 7px 8px; border-top: 1.5px solid #222; border-bottom: 0; font-size: 18px; font-weight: 700; letter-spacing: -.3px; }
  .calculation { padding: 16px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
  .totals { margin-top: 12px; text-align: right; }
  .due { margin-top: 5px; font-weight: 700; }
  .payment-card { padding-top: 20px; border-top: 1px solid #ddd; break-inside: avoid; font-size: 10px; color: #555; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 32px; padding-top: 18px; border-top: 1px solid #ddd; color: #777; font-size: 9px; break-inside: avoid; }
  .thank-you { color: #333; font-size: 18px; font-weight: 400; }
  .receipt-signoff { margin-top: 5px; color: #777; font-size: 9px; }
  .terms { overflow-wrap: anywhere; }
  .terms strong { display: block; margin-bottom: 5px; font-size: 9px; color: #555; }
  @media screen and (max-width: 640px) { body { padding: 12px; } .page { padding: 24px; } .masthead { flex-direction: column; } .receipt-heading { flex: auto; text-align: left; } .grid, .receipt-grid, .footer { grid-template-columns: 1fr; } }
  @media print { body { padding: 0; background: #fff; font-size: 11px; } .page { max-width: none; margin: 0; padding: 0; } .section { margin-top: 22px; } td { padding: 9px 7px; } a { color: inherit; text-decoration: none; } }
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
