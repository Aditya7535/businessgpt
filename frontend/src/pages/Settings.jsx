import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { settingsAPI, authAPI } from '../services/api'
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
  Check
} from 'lucide-react'
import toast from 'react-hot-toast'

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

  // Add user form
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserName, setNewUserName] = useState('')
  const [newUserRole, setNewUserRole] = useState('EMPLOYEE')
  const [newUserPin, setNewUserPin] = useState('')

  const fetchSettingsAndUsers = async () => {
    try {
      setLoading(true)
      const [setRes, usersRes] = await Promise.all([
        settingsAPI.getSettings(),
        authAPI.getUsers(),
      ])
      setSettings(setRes.data)
      setUsersList(usersRes.data)
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
      toast.success('Store settings saved successfully!')
    } catch (err) {
      toast.error('Failed to save settings.')
    } finally {
      setSaving(false)
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
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2">
          <SettingsIcon size={20} className="text-blue-500" />
          Store Configuration & System Settings
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Manage business tax parameters, team access PINs, UI appearance, and enterprise policies.
        </p>
      </div>

      {/* Theme Appearance */}
      <div className="os-surface p-5 space-y-3">
        <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
          {theme === 'dark' ? <Moon size={16} className="text-blue-500" /> : <Sun size={16} className="text-amber-500" />}
          Display Appearance & Theme
        </h2>
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-semibold text-[var(--text-main)]">OS Theme Mode</div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Currently using {theme === 'dark' ? 'Sleek Dark Mode (#0A0A0A)' : 'Clean Light Mode (#F8F8F8)'}
            </div>
          </div>
          <button onClick={toggleTheme} className="btn-ghost text-xs cursor-pointer">
            {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-500" />}
            Toggle to {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
        </div>
      </div>

      {/* Business Information Form */}
      <form onSubmit={handleSaveSettings} className="os-surface p-5 space-y-4">
        <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
          <Store size={16} className="text-blue-500" />
          Business Identity & GST Parameters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store / Business Name
            </label>
            <input
              type="text"
              value={settings.business_name || ''}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Owner Name
            </label>
            <input
              type="text"
              value={settings.owner_name || ''}
              onChange={(e) => setSettings({ ...settings, owner_name: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-blue-500"
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
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono text-[var(--text-main)] focus:outline-none focus:border-blue-500 uppercase"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store Support Phone
            </label>
            <input
              type="text"
              value={settings.phone || ''}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">
              Store Physical Address (Printed on Bills)
            </label>
            <textarea
              rows="2"
              value={settings.address || ''}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full p-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-blue-500"
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
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* User & PIN Management */}
      <div className="os-surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
              <Users size={16} className="text-blue-500" />
              Staff Team & PIN Access Control
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              Role permissions and 4-digit terminal access PINs.
            </p>
          </div>
          <button
            onClick={() => setShowAddUserModal(true)}
            className="btn-accent text-xs cursor-pointer py-1.5 px-3"
          >
            <Plus size={13} />
            Add Staff Member
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

                {u.id !== user.id && (
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
            <h2 className="text-sm font-bold text-[var(--text-main)] mb-1">Add Staff Member</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">Set up PIN access for new store staff.</p>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] font-medium block mb-1">Role Permission</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] text-[var(--text-main)] focus:outline-none focus:border-blue-500"
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
                  className="w-full p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-color)] font-mono text-[var(--text-main)] focus:outline-none focus:border-blue-500"
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
