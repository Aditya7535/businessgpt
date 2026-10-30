import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { settingsAPI, authAPI, whatsappAPI, customerAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import {
  Settings as SettingsIcon,
  Store,
  Users,
  ShieldCheck,
  Moon,
  Sun,
  Save,
  Trash2,
  Plus,
  KeyRound,
  Download,
  Check,
  MessageCircle,
  Bell,
  Smartphone,
  Send,
  Radio,
  FileCheck2,
  Contact,
  UserCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

const CUSTOMER_FIELD_OPTIONS = [
  { key: 'full_name', label: 'Full name', description: 'Customer legal or display name' },
  { key: 'phone', label: 'Phone number', description: 'Primary mobile number for SMS/WhatsApp receipts' },
  { key: 'email', label: 'Email address', description: 'Electronic email for digital invoices' },
  { key: 'billing_address', label: 'Billing address', description: 'Street address, city, and pincode' },
  { key: 'date_of_birth', label: 'Date of birth', description: 'Birthday for loyalty programs and greetings' },
  { key: 'notes', label: 'Customer notes', description: 'Internal remarks, preferences, or credit ledger notes' },
]

export default function Settings() {
  const { theme, toggleTheme, user } = useAuth()

  const [settings, setSettings] = useState({
    business_name: '',
    owner_name: '',
    address: '',
    gstin: '',
    phone: '',
    default_tax_rate: 5,
    low_stock_notification: true,
    daily_summary_notification: true,
  })
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Customer Information CRM State
  const [customerSettings, setCustomerSettings] = useState({
    enabled: false,
    allow_walk_in: true,
    customer_selection_optional: true,
    save_purchase_history: false,
    require_consent: false,
    enabled_fields: ['full_name', 'phone'],
    required_fields: []
  })
  const [savingCustomer, setSavingCustomer] = useState(false)

  // WhatsApp Integration State
  const [whatsappStatus, setWhatsappStatus] = useState(null)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [optInDigest, setOptInDigest] = useState(true)
  const [optInAlerts, setOptInAlerts] = useState(true)
  const [linkingWhatsapp, setLinkingWhatsapp] = useState(false)
  const [sendingTestMessage, setSendingTestMessage] = useState(false)

  // Add user form
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState('EMPLOYEE')
  const [newUserPin, setNewUserPin] = useState('')

  const fetchSettingsAndUsers = async () => {
    try {
      setLoading(true)
      const [setRes, usersRes, waRes, custRes] = await Promise.allSettled([
        settingsAPI.getSettings(),
        authAPI.getUsers(),
        whatsappAPI.getStatus(),
        customerAPI.getSettings()
      ])

      if (setRes.status === 'fulfilled') setSettings(setRes.value.data)
      if (usersRes.status === 'fulfilled') setUsersList(usersRes.value.data)
      if (custRes.status === 'fulfilled') setCustomerSettings(custRes.value.data)
      if (waRes.status === 'fulfilled') {
        setWhatsappStatus(waRes.value.data)
        if (waRes.value.data?.phone_number) {
          setWhatsappPhone(waRes.value.data.phone_number)
        }
        if (waRes.value.data?.opt_in_digest != null) {
          setOptInDigest(waRes.value.data.opt_in_digest)
        }
        if (waRes.value.data?.opt_in_alerts != null) {
          setOptInAlerts(waRes.value.data.opt_in_alerts)
        }
      }
    } catch (err) {
      toast.error('Failed to load store settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettingsAndUsers()
  }, [])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      await settingsAPI.updateSettings(settings)
      toast.success('Store identity & tax settings saved!')
    } catch (err) {
      toast.error('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCustomerSettings = async (e) => {
    if (e) e.preventDefault()
    try {
      setSavingCustomer(true)
      const res = await customerAPI.updateSettings({
        enabled: customerSettings.enabled,
        allow_walk_in: customerSettings.allow_walk_in,
        customer_selection_optional: customerSettings.customer_selection_optional,
        save_purchase_history: customerSettings.save_purchase_history,
        require_consent: customerSettings.require_consent,
        enabled_fields: customerSettings.enabled_fields,
        required_fields: customerSettings.required_fields,
      })
      setCustomerSettings(res.data)
      toast.success('Customer Information & CRM settings saved!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save customer settings.')
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleMasterToggle = async (checked) => {
    const updated = { ...customerSettings, enabled: checked }
    setCustomerSettings(updated)
    try {
      setSavingCustomer(true)
      const res = await customerAPI.updateSettings({
        enabled: checked,
        allow_walk_in: updated.allow_walk_in,
        customer_selection_optional: updated.customer_selection_optional,
        save_purchase_history: updated.save_purchase_history,
        require_consent: updated.require_consent,
        enabled_fields: updated.enabled_fields,
        required_fields: updated.required_fields,
      })
      setCustomerSettings(res.data)
      if (checked) {
        toast.success('Customer information collection enabled.')
      } else {
        toast.success('Customer collection disabled. Walk-in mode is now active.')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update customer collection mode.')
      // revert state on error
      setCustomerSettings(customerSettings)
    } finally {
      setSavingCustomer(false)
    }
  }

  const handleFieldToggle = (fieldKey) => {
    setCustomerSettings((prev) => {
      const isEnabled = prev.enabled_fields.includes(fieldKey)
      const nextEnabled = isEnabled
        ? prev.enabled_fields.filter((f) => f !== fieldKey)
        : [...prev.enabled_fields, fieldKey]
      const nextRequired = prev.required_fields.filter((f) => f !== fieldKey)
      return {
        ...prev,
        enabled_fields: nextEnabled,
        required_fields: nextRequired,
      }
    })
  }

  const handleRequiredToggle = (fieldKey) => {
    setCustomerSettings((prev) => {
      if (!prev.enabled_fields.includes(fieldKey)) return prev
      const isRequired = prev.required_fields.includes(fieldKey)
      const nextRequired = isRequired
        ? prev.required_fields.filter((f) => f !== fieldKey)
        : [...prev.required_fields, fieldKey]
      return {
        ...prev,
        required_fields: nextRequired,
      }
    })
  }

  const handleLinkWhatsapp = async (e) => {
    e.preventDefault()
    if (!whatsappPhone.trim()) {
      toast.error('Please enter a valid WhatsApp phone number.')
      return
    }

    try {
      setLinkingWhatsapp(true)
      await whatsappAPI.linkNumber(whatsappPhone.trim(), optInDigest, optInAlerts)
      toast.success('WhatsApp number linked successfully!')
      const res = await whatsappAPI.getStatus()
      setWhatsappStatus(res.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to link WhatsApp number.')
    } finally {
      setLinkingWhatsapp(false)
    }
  }

  const handleTestWhatsappMessage = async () => {
    if (!whatsappStatus?.configured) {
      toast.error('WhatsApp service is in Standby. Configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env to send real messages.')
      return
    }
    try {
      setSendingTestMessage(true)
      await whatsappAPI.testMessage(
        '🚀 BusinessGPT Test: Store connection established! Daily sales ledger & urgent stockout alerts will deliver here.',
        whatsappPhone || '+919876543210'
      )
      toast.success('Test alert dispatched to WhatsApp queue!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'WhatsApp test dispatch failed. Check Twilio credentials.')
    } finally {
      setSendingTestMessage(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUserName.trim() || newUserPin.length < 4) {
      toast.error('Please enter name and a 4-digit PIN.')
      return
    }

    try {
      await authAPI.createUser({
        name: newUserName.trim(),
        role: newUserRole,
        pin: newUserPin,
      })
      toast.success(`User '${newUserName}' created with PIN ${newUserPin}!`)
      setShowAddUserModal(false)
      setNewUserName('')
      setNewUserPin('')
      fetchSettingsAndUsers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create user.')
    }
  }

  const handleDeleteUser = async (userId, userName) => {
    if (userId === user.id) {
      toast.error('Cannot delete yourself.')
      return
    }
    if (!window.confirm(`Are you sure you want to remove user '${userName}'?`)) return

    try {
      await authAPI.deleteUser(userId)
      toast.success(`User '${userName}' removed.`)
      fetchSettingsAndUsers()
    } catch (err) {
      toast.error('Failed to delete user.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="space-y-6 max-w-5xl mx-auto pb-10"
    >
      {/* Editorial Prologue Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[var(--border-color)] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
              Enterprise Configuration · Controls
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
            Store Identity, Team Access & Integrations
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
            GSTIN configuration, thermal receipt parameters, CRM fields, staff PINs, and automated messaging.
          </p>
        </div>
      </div>

      {/* ── SECTION 1: Theme & Display Appearance ── */}
      <div className="os-surface p-5 space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
          {theme === 'dark' ? <Moon size={16} className="text-[var(--accent)]" /> : <Sun size={16} className="text-amber-500" />}
          Display Appearance & OS Theme
        </h2>
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-semibold text-[var(--text-main)]">Console Aesthetic</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Currently operating in {theme === 'dark' ? 'Obsidian Editorial Dark Mode' : 'Warm Alabaster Light Mode'}
            </div>
          </div>
          <button onClick={toggleTheme} className="btn-ghost text-xs cursor-pointer">
            {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-500" />}
            Toggle to {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>
      </div>

      {/* ── SECTION 2: Business Identity & Tax Parameters ── */}
      <form onSubmit={handleSaveSettings} className="os-surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
            <Store size={16} className="text-[var(--accent)]" />
            Store Master Identity & GST Parameters
          </h2>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            Printed on 80mm POS Receipts
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store / Business Legal Name
            </label>
            <input
              type="text"
              value={settings.business_name || ''}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store Owner Name
            </label>
            <input
              type="text"
              value={settings.owner_name || ''}
              onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              GSTIN (Goods and Services Tax ID)
            </label>
            <input
              type="text"
              value={settings.gstin || ''}
              onChange={(e) => setSettings({ ...settings, gstin: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)] uppercase"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store Phone / Helpdesk
            </label>
            <input
              type="text"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store Physical Address (Printed on Bill Header)
            </label>
            <textarea
              rows="2"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-accent text-xs font-semibold py-2 px-5 cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Store Master'}
          </button>
        </div>
      </form>

      {/* ── SECTION 3: Customer Information & CRM Settings ── */}
      <div className="os-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <Contact size={16} className="text-[var(--accent)]" />
              Customer Information
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Configure optional customer details collection, walk-in checkout rules, and privacy compliance for POS billing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded font-bold border ${
                customerSettings.enabled
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
              }`}
            >
              {customerSettings.enabled ? '● Collection Enabled' : '○ Disabled (Walk-in Mode)'}
            </span>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="p-3.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
              <span>Enable customer information collection</span>
              <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                (Master Toggle)
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              When disabled, POS checkout operates in rapid walk-in mode without requesting customer details.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={customerSettings.enabled}
              onChange={(e) => handleMasterToggle(e.target.checked)}
              disabled={savingCustomer}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
          </label>
        </div>

        {customerSettings.enabled ? (
          <div className="space-y-4 pt-1">
            {/* Operational Toggles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                <input
                  type="checkbox"
                  checked={customerSettings.customer_selection_optional}
                  onChange={(e) => setCustomerSettings({ ...customerSettings, customer_selection_optional: e.target.checked })}
                  className="mt-0.5 rounded text-[var(--accent)] cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-[var(--text-main)]">Make customer selection optional</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Cashier can skip customer selection and bill directly. (Enabled by default)</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                <input
                  type="checkbox"
                  checked={customerSettings.allow_walk_in}
                  onChange={(e) => setCustomerSettings({ ...customerSettings, allow_walk_in: e.target.checked })}
                  className="mt-0.5 rounded text-[var(--accent)] cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-[var(--text-main)]">Allow walk-in customers</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Enable checkout for walk-in shoppers without registration. (Enabled by default)</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                <input
                  type="checkbox"
                  checked={customerSettings.save_purchase_history}
                  onChange={(e) => setCustomerSettings({ ...customerSettings, save_purchase_history: e.target.checked })}
                  className="mt-0.5 rounded text-[var(--accent)] cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-[var(--text-main)]">Save customer purchase history</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Link bills to customer profiles to track total spend, bill numbers, and purchase dates.</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] cursor-pointer hover:border-[var(--accent)] transition-colors">
                <input
                  type="checkbox"
                  checked={customerSettings.require_consent}
                  onChange={(e) => setCustomerSettings({ ...customerSettings, require_consent: e.target.checked })}
                  className="mt-0.5 rounded text-[var(--accent)] cursor-pointer"
                />
                <div>
                  <div className="font-semibold text-[var(--text-main)]">Ask for customer consent before saving details</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Require explicit consent checkbox before saving customer details.</div>
                </div>
              </label>
            </div>

            {/* Configurable Customer Fields */}
            <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-surface-elevated)]">
              <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-surface)] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">
                    Configurable Customer Fields for POS Billing
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Select which fields appear in checkout, and choose which are required vs optional.
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                  6 Available Fields
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[10px] font-mono uppercase text-[var(--text-dim)]">
                      <th className="p-2.5 pl-4">Customer Field</th>
                      <th className="p-2.5 text-center">Appear in POS Checkout</th>
                      <th className="p-2.5 pr-4 text-center">Mark as Required</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {CUSTOMER_FIELD_OPTIONS.map((f) => {
                      const isEnabled = customerSettings.enabled_fields?.includes(f.key)
                      const isRequired = customerSettings.required_fields?.includes(f.key)

                      return (
                        <tr key={f.key} className="hover:bg-[var(--bg-surface)] transition-colors">
                          <td className="p-2.5 pl-4">
                            <div className="font-semibold text-[var(--text-main)]">{f.label}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{f.description}</div>
                          </td>
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => handleFieldToggle(f.key)}
                              className="rounded text-[var(--accent)] cursor-pointer w-4 h-4"
                            />
                          </td>
                          <td className="p-2.5 pr-4 text-center">
                            <input
                              type="checkbox"
                              disabled={!isEnabled}
                              checked={isEnabled && isRequired}
                              onChange={() => handleRequiredToggle(f.key)}
                              className="rounded text-[var(--accent)] cursor-pointer w-4 h-4 disabled:opacity-25 disabled:cursor-not-allowed"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 text-xs text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-lg">
            Customer information collection is disabled. POS billing will operate in fast walk-in mode without prompting for customer details.
          </div>
        )}

        {/* Save Customer Settings Button - Always accessible */}
        <div className="flex justify-end pt-2 border-t border-[var(--border-color)]">
          <button
            type="button"
            onClick={handleSaveCustomerSettings}
            disabled={savingCustomer}
            className="btn-accent text-xs font-semibold py-2 px-5 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save size={14} />
            <span>{savingCustomer ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 4: WhatsApp Business Integration ── */}
      <div className="os-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-color)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <MessageCircle size={16} className="text-emerald-500" />
              WhatsApp Business & Daily Digest Integration
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Automated daily morning revenue summaries and critical stockout alerts delivered directly to your WhatsApp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                whatsappStatus?.configured
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
              }`}
            >
              {whatsappStatus?.configured ? '● WhatsApp Connected' : '○ Standby'}
            </span>
          </div>
        </div>

        {!whatsappStatus?.configured && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <span>⚠️ WhatsApp Service in Standby</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Real WhatsApp dispatch requires <code className="text-amber-300 font-mono">TWILIO_ACCOUNT_SID</code> and <code className="text-amber-300 font-mono">TWILIO_AUTH_TOKEN</code> configured in your <code className="text-amber-300 font-mono">backend/.env</code> file.
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              If using the free Twilio Sandbox, remember to join by sending your sandbox keyword to <code className="text-amber-300 font-mono">+1 415 523 8886</code> from your WhatsApp on <code className="text-amber-300 font-mono">{whatsappPhone || 'your phone'}</code>.
            </p>
          </div>
        )}

        <form onSubmit={handleLinkWhatsapp} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
                Owner WhatsApp Phone Number (with Country Code)
              </label>
              <input
                type="text"
                placeholder="e.g. +919876543210"
                value={whatsappPhone}
                onChange={(e) => setWhatsappPhone(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-main)]">
                <input
                  type="checkbox"
                  checked={optInDigest}
                  onChange={(e) => setOptInDigest(e.target.checked)}
                  className="rounded text-[var(--accent)]"
                />
                <span>Receive 9:00 AM Morning Business Performance Digest</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-main)]">
                <input
                  type="checkbox"
                  checked={optInAlerts}
                  onChange={(e) => setOptInAlerts(e.target.checked)}
                  className="rounded text-[var(--accent)]"
                />
                <span>Receive Instant WhatsApp alerts for Critical Stockouts</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={handleTestWhatsappMessage}
              disabled={sendingTestMessage}
              className="btn-ghost text-xs cursor-pointer flex items-center gap-1.5"
            >
              <Send size={13} />
              <span>{sendingTestMessage ? 'Dispatching...' : 'Send Test WhatsApp Alert'}</span>
            </button>

            <button
              type="submit"
              disabled={linkingWhatsapp}
              className="btn-accent text-xs cursor-pointer"
            >
              {linkingWhatsapp ? 'Linking...' : 'Update WhatsApp Preferences'}
            </button>
          </div>
        </form>
      </div>

      {/* ── SECTION 5: Team Access & PIN Control ── */}
      <div className="os-surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <Users size={16} className="text-[var(--accent)]" />
              Staff Team & PIN Access Control
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Assign cashier PINs (Employee) and manager roles for POS counter safety.
            </p>
          </div>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="btn-accent text-xs cursor-pointer py-1.5 px-3"
          >
            <Plus size={13} />
            <span>Add Staff Member</span>
          </button>
        </div>

        <div className="divide-y divide-[var(--border-color)]">
          {usersList.map((u) => (
            <div key={u.id} className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] flex items-center justify-center font-bold text-xs text-[var(--text-main)]">
                  {u.name.slice(0, 1)}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-main)]">{u.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">Role: {u.role}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                    u.role === 'OWNER'
                      ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      : u.role === 'MANAGER'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}
                >
                  {u.role}
                </span>

                {u.id !== user?.id && (
                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    className="p-1.5 rounded text-[var(--text-muted)] hover:text-red-500 transition-colors cursor-pointer"
                    title="Remove user"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MODAL: ADD USER ── */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="os-surface max-w-sm w-full p-6 relative">
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">
              Add Staff Member
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Set up a 4-digit PIN for store terminal authentication.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Role Permission</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="EMPLOYEE">Employee (Counter POS View Only)</option>
                  <option value="MANAGER">Manager (Operations + Inventory)</option>
                  <option value="OWNER">Owner (Full AI + BI Access)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">4-Digit Access PIN</label>
                <input
                  type="password"
                  maxLength="6"
                  required
                  placeholder="e.g. 4455"
                  value={newUserPin}
                  onChange={(e) => setNewUserPin(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="btn-ghost text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-accent text-xs cursor-pointer">
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  )
}
