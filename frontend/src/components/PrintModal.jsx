import React, { useEffect } from 'react'
import { Printer, X, CheckCircle2 } from 'lucide-react'

export default function PrintModal({
  bill,
  storeSettings = {},
  cashierName,
  isOpen,
  onClose,
  autoPrint = true
}) {
  const handlePrint = () => {
    const printEl = document.getElementById('receipt-print')
    if (!printEl) return
    const receiptContent = printEl.innerHTML
    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      window.print()
      return
    }
    printWindow.document.write(`
        <html>
        <head>
            <title>Store Bill Receipt</title>
            <style>
                body { 
                    font-family: monospace; 
                    font-size: 12px;
                    margin: 0;
                    padding: 10px;
                    width: 80mm;
                    color: #000;
                    background: #fff;
                }
                .divider { border-top: 1px dashed #000; margin: 5px 0; }
                .center { text-align: center; }
                .right { text-align: right; }
                .bold { font-weight: bold; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 2px 0; }
            </style>
        </head>
        <body>
            ${receiptContent}
        </body>
        </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  useEffect(() => {
    if (!isOpen || !bill) return

    let printTimer = null
    if (autoPrint) {
      printTimer = setTimeout(() => {
        handlePrint()
      }, 350)
    }

    return () => {
      if (printTimer) clearTimeout(printTimer)
    }
  }, [isOpen, bill, autoPrint])

  if (!isOpen || !bill) return null

  const dateObj = new Date(bill.created_at || Date.now())
  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = dateObj.toLocaleString('en-US', { month: 'short' })
  const year = dateObj.getFullYear()
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const formattedDate = `${day} ${month} ${year}  ${hours}:${minutes}`

  const subtotal = Math.max(0, (bill.total_amount || 0) - (bill.tax_amount || 0)).toFixed(2)
  const taxAmount = (bill.tax_amount || 0).toFixed(2)
  const total = Number(bill.total_amount || 0).toFixed(2)

  const storeName = storeSettings.business_name || 'Bharat General Store & Supermart'
  const storeAddress = storeSettings.address || 'Shop No. 12, Main Market, MG Road, Mumbai 400001'
  const gstNumber = storeSettings.gstin || '27AABCB1234F1Z5'
  const employeeName = bill.employee_name || cashierName || 'Cashier'
  const paymentMethod = bill.payment_method || 'UPI'
  const items = bill.items || []

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="os-surface max-w-sm w-full p-5 relative max-h-[92vh] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Controls Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <h3 className="font-bold text-xs text-[var(--text-main)]">
              Transaction Success
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--text-main)]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Paper Receipt Card Container */}
        <div className="bg-white text-black p-5 rounded-lg border border-gray-200 shadow-inner font-mono text-xs select-text">
          <div id="receipt-print">
            {/* Store Banner */}
            <div className="center">
              <div className="bold" style={{ fontSize: '14px', textTransform: 'uppercase' }}>
                {storeName}
              </div>
              <div style={{ fontSize: '10px', marginTop: '2px' }}>{storeAddress}</div>
              <div style={{ fontSize: '10px' }}>GSTIN: {gstNumber}</div>
            </div>

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Bill Info */}
            <div style={{ fontSize: '10px' }}>
              <div>INVOICE: #{bill.bill_number || bill.id}</div>
              <div>DATE: {formattedDate}</div>
              <div>CASHIER: {employeeName}</div>
              <div>PAYMENT: {paymentMethod.toUpperCase()}</div>
              {bill.customer_name && <div>CUSTOMER: {bill.customer_name.toUpperCase()}</div>}
              {bill.customer_phone && <div>MOBILE: {bill.customer_phone}</div>}
              {bill.customer_address && <div>ADDRESS: {bill.customer_address}</div>}
            </div>

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Items Table */}
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td style={{ textAlign: 'left', fontWeight: 'bold' }}>ITEM</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>QTY</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>PRICE</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>AMT</td>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'left', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.name || it.product_name}
                    </td>
                    <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{Number(it.unit_price).toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{Number(it.subtotal || it.quantity * it.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            {/* Totals */}
            <div style={{ fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₹{subtotal}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>GST:</span>
                <span>₹{taxAmount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}>
                <span>TOTAL:</span>
                <span>₹{total}</span>
              </div>
            </div>

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />

            <div className="center" style={{ fontSize: '10px', marginTop: '6px' }}>
              Thank You! Visit Again.
              <br />
              Powered by BusinessGPT Enterprise
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 mt-4">
          <button
            onClick={handlePrint}
            className="flex-1 btn-accent py-2 text-xs font-semibold cursor-pointer"
          >
            <Printer size={13} />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="btn-ghost py-2 text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
