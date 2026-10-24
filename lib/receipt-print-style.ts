/** Customer-facing receipt print layout. Keep customer data escaped in the caller. */
export const RECEIPT_PRINT_STYLES = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px; background: #f7f8f6; color: #202c25; font: 12px/1.6 Arial, sans-serif; }
  .page { max-width: 900px; margin: 0 auto; padding: 36px; background: #fff; border: 1px solid #dfe6e0; border-top: 3px solid #176344; border-radius: 12px; }
  .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 28px; padding-bottom: 24px; border-bottom: 1px solid #e4e9e4; }
  .company-header { display: flex; align-items: flex-start; gap: 14px; min-width: 0; }
  .company-logo { width: 52px; height: 52px; flex: 0 0 52px; object-fit: contain; border-radius: 8px; }
  .company-meta { color: #65736a; font-size: 11px; line-height: 1.7; overflow-wrap: anywhere; }
  .company-name { margin-bottom: 4px; color: #202c25; font-size: 16px; font-weight: 700; }
  .receipt-heading { min-width: 150px; text-align: right; }
  .eyebrow { color: #202c25; font-size: 32px; line-height: 1.2; font-weight: 600; letter-spacing: -1px; }
  .receipt-no { margin-top: 10px; color: #526157; font-family: monospace; font-size: 11px; overflow-wrap: anywhere; }
  .issued { margin-top: 4px; color: #65736a; font-size: 11px; }
  .status { display: inline-block; margin-top: 8px; padding: 3px 9px; border: 1px solid #cce0d4; border-radius: 20px; color: #176344; font-size: 10px; font-weight: 700; text-transform: capitalize; }
  .status.unpaid { color: #875a16; border-color: #e5d5b7; }
  .status.overdue { color: #9d3b39; border-color: #e5c7c7; }
  .status.cancelled { color: #9d3b39; border-color: #e5c7c7; }
  .amount-band { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 24px; padding: 16px 18px; border: 1px solid #dceadf; border-radius: 10px; background: #f3f8f4; }
  .amount-label { font-size: 11px; font-weight: 700; color: #315640; }
  .amount { font-size: 24px; line-height: 1.3; font-weight: 700; color: #1c5036; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  /* The masthead and payment strip form one distinctive ISP receipt identity. */
  .page { border: 1px solid #dfe6e0; border-radius: 4px; padding: 0; overflow: hidden; }
  .masthead { padding: 24px 28px 22px; background: #142831; border-bottom: 0; color: #fff; }
  .company-header { flex: 1; }
  .company-meta { color: #c0cdd0; }
  .company-name { color: #fff; font-size: 17px; }
  .receipt-heading { min-width: 225px; flex: 0 0 225px; }
  .service-label { color: #7cddbc; font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .eyebrow { color: #fff; margin-top: 7px; font-size: 24px; letter-spacing: -.6px; }
  .receipt-no, .issued { color: #c0cdd0; }
  .status { color: #a2efd2; border-color: #638778; }
  .status.cancelled { color: #ffd1cd; border-color: #d49a94; }
  .amount-band { margin: 0; border: 0; border-bottom: 1px solid #d5e7de; border-radius: 0; padding: 16px 28px; background: #edf7f2; }
  .amount { flex: 0 0 auto; white-space: nowrap; font-size: 26px; letter-spacing: -.7px; }
  .content { padding: 0 28px 20px; }
  .section { margin-top: 24px; line-height: 1.7; }
  .title { margin-bottom: 10px; color: #65736a; font-size: 10px; letter-spacing: .8px; font-weight: 700; text-transform: uppercase; break-after: avoid; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .receipt-grid { grid-template-columns: 1fr 1fr 1.2fr; gap: 20px; }
  .info-card { min-width: 0; break-inside: avoid; overflow-wrap: anywhere; }
  .info-card div + div { margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; font-variant-numeric: tabular-nums; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { padding: 10px 8px; background: #f2f5f2; border-top: 1px solid #dfe6e0; border-bottom: 1px solid #dfe6e0; color: #526157; text-align: left; font-size: 10px; font-weight: 700; }
  td { padding: 10px 8px; border-bottom: 1px solid #e8ece8; vertical-align: top; overflow-wrap: anywhere; }
  .right { text-align: right; white-space: nowrap; }
  th:nth-child(n+3) { text-align: right; }
  td:nth-child(2) { padding-right: 14px; }
  .bold { font-weight: 700; }
  .total { padding-top: 15px; color: #176344; background: #f3f8f4; font-size: 14px; font-weight: 700; border-top: 1px solid #d6e6d9; }
  .calculation { padding: 16px; border: 1px solid #e1e7e1; border-radius: 10px; }
  .totals { margin-top: 12px; text-align: right; }
  .due { margin-top: 5px; color: #176344; font-weight: 700; }
  .payment-card { padding: 16px; border: 1px solid #e1e7e1; border-radius: 10px; break-inside: avoid; }
  .payment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 20px; }
  .footer { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; align-items: start; margin-top: 30px; padding-top: 16px; border-top: 1px solid #e1e7e1; color: #65736a; font-size: 10px; break-inside: avoid; }
  .thank-you { margin-bottom: 8px; color: #315640; font-size: 14px; font-weight: 600; }
  .receipt-signoff { margin-top: 6px; color: #65736a; font-size: 10px; font-weight: 400; }
  .terms strong { display: block; margin-bottom: 4px; color: #526157; font-size: 10px; }
  @media screen and (max-width: 640px) { body { padding: 12px; } .page { padding: 0; } .masthead { padding: 24px; } .content { padding: 0 20px 24px; } .amount-band { padding: 18px 20px; } .masthead { flex-direction: column; } .receipt-heading { text-align: left; } .grid, .receipt-grid { grid-template-columns: 1fr; gap: 18px; } .amount-band { flex-wrap: wrap; } .footer { grid-template-columns: 1fr; } }
  @media print { body { font-size: 11px; line-height: 1.5; } .section { line-height: 1.5; } th, td { padding: 6px 8px; } .section { margin-top: 16px; } .payment-card { padding: 12px; } .title { margin-bottom: 7px; } .footer { margin-top: 20px; padding-top: 12px; } body { padding: 0; background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .page { max-width: none; margin: 0; padding: 0; border: 1px solid #dfe6e0; border-radius: 0; overflow: visible; } a { color: inherit; text-decoration: none; } }
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
