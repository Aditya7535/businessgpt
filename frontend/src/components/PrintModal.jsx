import React, { useEffect } from 'react'
import { Printer, X } from 'lucide-react'

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
            <title>Bill Receipt</title>
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

  // Format Date: 15 Jan 2024  14:30
  const dateObj = new Date(bill.created_at || Date.now())
  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = dateObj.toLocaleString('en-US', { month: 'short' })
  const year = dateObj.getFullYear()
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  const formattedDate = `${day} ${month} ${year}  ${hours}:${minutes}`

  // Financials & details
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="os-surface max-w-sm w-full p-5 relative max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button for Screen */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
        >
          <X size={18} />
        </button>

        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
          Thermal Receipt Preview (80mm)
        </h3>

        {/* Receipt HTML structure in PrintModal */}
        <div
          id="receipt-print"
          className="font-mono text-xs text-black bg-white p-4 rounded-lg border border-gray-300 shadow-inner"
          style={{ width: '80mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '12px' }}
        >
          <style>{`
            #receipt-print .divider { border-top: 1px dashed #000; margin: 5px 0; }
            #receipt-print .center { text-align: center; }
            #receipt-print .right { text-align: right; }
            #receipt-print .bold { font-weight: bold; }
            #receipt-print table { width: 100%; border-collapse: collapse; }
            #receipt-print td { padding: 2px 0; }
          `}</style>
          <div className="center bold">
            {storeName}
          </div>
          <div className="center">{storeAddress}</div>
          <div className="center">GST: {gstNumber}</div>
          <div className="divider"></div>
          <div>Bill No: {bill.bill_number}</div>
          <div>Date: {formattedDate}</div>
          <div>Cashier: {employeeName}</div>
          <div className="divider"></div>
          <table>
            <thead>
              <tr style={{ fontWeight: 'bold' }}>
                <td style={{ textAlign: 'left' }}>Item</td>
                <td style={{ textAlign: 'center' }}>Qty</td>
                <td style={{ textAlign: 'right' }}>Rate</td>
                <td className="right">Amt</td>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx}>
                  <td style={{ textAlign: 'left' }}>{item.product_name}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>₹{Number(item.unit_price || 0).toFixed(0)}</td>
                  <td className="right">₹{Number(item.subtotal || 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="divider"></div>
          <div className="right">Subtotal: ₹{subtotal}</div>
          <div className="right">GST: ₹{taxAmount}</div>
          <div className="right bold">TOTAL: ₹{total}</div>
          <div>Payment: {paymentMethod}</div>
          <div className="divider"></div>
          <div className="center">Thank you! Visit again.</div>
          <div className="center">BusinessGPT v8.0</div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 btn-accent py-2 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer size={14} />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="btn-ghost py-2 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

