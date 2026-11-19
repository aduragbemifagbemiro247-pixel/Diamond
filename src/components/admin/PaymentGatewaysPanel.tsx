import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { ShippingZone } from '../../types';

interface GatewayItem {
  id: number;
  provider: string;
  displayName: string;
  mode: 'test' | 'live';
  publicKey: string;
  hasSecretKey: boolean;
  secretKeyMasked: string;
  hasWebhookSecret: boolean;
  webhookSecretMasked: string;
  config: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    instructions?: string;
    eligibleStates?: string[];
    additionalFee?: number;
  };
  isActive: boolean;
  isDefault: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string;
}

interface ProviderOption {
  id: string;
  name: string;
  kind: 'online' | 'manual' | 'cod';
  description: string;
  supportsWebhook: boolean;
}

export function PaymentGatewaysPanel({
  adminToken,
  isSuperAdmin,
  shippingZones,
  showToast,
}: {
  adminToken: string;
  isSuperAdmin: boolean;
  shippingZones: ShippingZone[];
  showToast: (msg: string, tone?: 'default' | 'error') => void;
}) {
  const [gateways, setGateways] = useState<GatewayItem[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GatewayItem | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Form fields
  const [provider, setProvider] = useState('paystack');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  // Bank transfer & COD config
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [instructions, setInstructions] = useState('');
  const [eligibleStates, setEligibleStates] = useState<string[]>([]);
  const [additionalFee, setAdditionalFee] = useState('0');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [gwRes, provRes] = await Promise.all([
        apiFetch<{ gateways: GatewayItem[] }>('/api/admin/payment-gateways', {
          adminToken,
        }),
        apiFetch<{ providers: ProviderOption[] }>(
          '/api/admin/payment-gateways/providers',
          { adminToken }
        ),
      ]);
      setGateways(gwRes.gateways);
      setProviders(provRes.providers);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Unable to load gateways.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [adminToken]);

  const openAdd = () => {
    setEditing(null);
    setProvider('paystack');
    setDisplayName('Paystack Checkout');
    setMode('test');
    setPublicKey('');
    setSecretKey('');
    setWebhookSecret('');
    setIsActive(true);
    setIsDefault(false);
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    setInstructions('');
    setEligibleStates(shippingZones.filter((z) => z.codAllowed).map((z) => z.stateName));
    setAdditionalFee('1500');
    setModalOpen(true);
  };

  const openEdit = (gw: GatewayItem) => {
    setEditing(gw);
    setProvider(gw.provider);
    setDisplayName(gw.displayName);
    setMode(gw.mode);
    setPublicKey(gw.publicKey);
    setSecretKey('');
    setWebhookSecret('');
    setIsActive(gw.isActive);
    setIsDefault(gw.isDefault);
    setBankName(gw.config?.bankName || '');
    setAccountName(gw.config?.accountName || '');
    setAccountNumber(gw.config?.accountNumber || '');
    setInstructions(gw.config?.instructions || '');
    setEligibleStates(gw.config?.eligibleStates || []);
    setAdditionalFee(String(gw.config?.additionalFee ?? 0));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const config =
        provider === 'bank_transfer'
          ? { bankName, accountName, accountNumber, instructions }
          : provider === 'cash_on_delivery'
            ? {
                eligibleStates,
                additionalFee: Math.max(0, Math.round(Number(additionalFee || 0))),
              }
            : {};

      if (editing) {
        await apiFetch(`/api/admin/payment-gateways/${editing.id}`, {
          method: 'PUT',
          adminToken,
          body: JSON.stringify({
            displayName,
            mode,
            publicKey,
            secretKey: secretKey.trim() || undefined,
            webhookSecret: webhookSecret.trim() || undefined,
            config,
            isActive,
            isDefault,
          }),
        });
        showToast('Payment gateway updated. Checkout reflects changes immediately.');
      } else {
        await apiFetch('/api/admin/payment-gateways', {
          method: 'POST',
          adminToken,
          body: JSON.stringify({
            provider,
            displayName,
            mode,
            publicKey,
            secretKey,
            webhookSecret,
            config,
            isActive,
            isDefault,
          }),
        });
        showToast('Payment gateway added successfully.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (gw: GatewayItem) => {
    try {
      await apiFetch(`/api/admin/payment-gateways/${gw.id}`, {
        method: 'PUT',
        adminToken,
        body: JSON.stringify({ isActive: !gw.isActive }),
      });
      showToast(
        `${gw.displayName} ${!gw.isActive ? 'activated' : 'deactivated'} on checkout.`
      );
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    }
  };

  const handleSetDefault = async (gw: GatewayItem) => {
    try {
      await apiFetch(`/api/admin/payment-gateways/${gw.id}`, {
        method: 'PUT',
        adminToken,
        body: JSON.stringify({ isDefault: true, isActive: true }),
      });
      showToast(`${gw.displayName} set as default checkout gateway.`);
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    }
  };

  const handleTest = async (gw: GatewayItem) => {
    setTestingId(gw.id);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(
        `/api/admin/payment-gateways/${gw.id}/test`,
        {
          method: 'POST',
          adminToken,
        }
      );
      showToast(res.message, res.ok ? 'default' : 'error');
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Connection test failed.', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (gw: GatewayItem) => {
    try {
      await apiFetch(`/api/admin/payment-gateways/${gw.id}`, {
        method: 'DELETE',
        adminToken,
      });
      showToast('Gateway configuration removed.');
      await loadData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
    }
  };

  const isOnlineProvider = ['paystack', 'flutterwave', 'stripe'].includes(provider);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">
            Dynamic Payment Gateway Management
          </h2>
          <p className="text-xs text-[#111111]/65 mt-1">
            Only activated gateways appear to customers at checkout. Secret keys are
            AES-256 encrypted on the server and never exposed to frontend code.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#222222] shrink-0"
          >
            <Plus className="w-4 h-4 text-[#D4AF37]" />
            <span>Add Payment Gateway</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-48 bg-white border border-black/10 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className="bg-white border border-black/10 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base text-[#111111]">
                        {gw.displayName}
                      </h3>
                      {gw.isDefault && (
                        <span className="text-[11px] font-mono text-[#8C6D14] font-semibold">
                          · Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#111111]/55 mt-0.5 capitalize">
                      Provider: {gw.provider.replace(/_/g, ' ')} · Mode: {gw.mode.toUpperCase()}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      gw.isActive ? 'text-emerald-700' : 'text-[#111111]/45'
                    }`}
                  >
                    {gw.isActive ? 'Active on Checkout' : 'Inactive'}
                  </span>
                </div>

                {['paystack', 'flutterwave', 'stripe'].includes(gw.provider) && (
                  <div className="p-3 bg-[#F5F5F5] text-xs font-mono space-y-1">
                    <div className="truncate">
                      Public Key: {gw.publicKey || 'Not configured'}
                    </div>
                    <div>
                      Secret Key:{' '}
                      {gw.hasSecretKey ? gw.secretKeyMasked : 'Not configured'}
                    </div>
                    <div>
                      Webhook Secret:{' '}
                      {gw.hasWebhookSecret ? gw.webhookSecretMasked : 'Not set'}
                    </div>
                  </div>
                )}

                {gw.provider === 'bank_transfer' && (
                  <div className="p-3 bg-[#F5F5F5] text-xs space-y-1">
                    <div>
                      Bank: <span className="font-semibold">{gw.config?.bankName}</span>
                    </div>
                    <div>
                      Account:{' '}
                      <span className="font-semibold">{gw.config?.accountName}</span> ·{' '}
                      <span className="font-mono">{gw.config?.accountNumber}</span>
                    </div>
                  </div>
                )}

                {gw.provider === 'cash_on_delivery' && (
                  <div className="p-3 bg-[#F5F5F5] text-xs space-y-1">
                    <div>
                      Additional COD Fee:{' '}
                      <span className="font-mono font-semibold">
                        ₦{Number(gw.config?.additionalFee || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      Eligible States: {(gw.config?.eligibleStates || []).join(', ') || 'All COD Zones'}
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-[#111111]/55 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8C6D14]" />
                  <span>
                    Connection Status: {gw.lastTestStatus}{' '}
                    {gw.lastTestedAt
                      ? `(${new Date(gw.lastTestedAt).toLocaleDateString()})`
                      : ''}
                  </span>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-black/8">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(gw)}
                    className={`px-3 py-1.5 text-xs font-medium border ${
                      gw.isActive
                        ? 'border-black/20 text-[#111111] hover:bg-[#F5F5F5]'
                        : 'bg-[#111111] text-white border-[#111111]'
                    }`}
                  >
                    {gw.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(gw)}
                    className="px-3 py-1.5 text-xs font-medium border border-black/20 hover:bg-[#F5F5F5]"
                  >
                    Configure
                  </button>
                  <button
                    type="button"
                    disabled={testingId === gw.id}
                    onClick={() => handleTest(gw)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-black/20 hover:bg-[#F5F5F5]"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${testingId === gw.id ? 'animate-spin' : ''}`}
                    />
                    <span>Test</span>
                  </button>
                  {!gw.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(gw)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-black/20 hover:bg-[#F5F5F5]"
                    >
                      <CheckCircle2 className="w-3 h-3 text-[#8C6D14]" />
                      <span>Set Default</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(gw)}
                    aria-label="Delete gateway"
                    className="ml-auto p-1.5 text-[#111111]/45 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Gateway Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border border-black/15 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <h3 className="font-display text-2xl font-semibold">
                {editing ? `Configure ${editing.displayName}` : 'Add Payment Gateway'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[#111111]/60 hover:text-[#111111]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                    Integrated Payment Provider
                  </label>
                  <select
                    value={provider}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProvider(val);
                      const found = providers.find((p) => p.id === val);
                      if (found) setDisplayName(found.name);
                    }}
                    className="w-full px-3.5 py-2.5 border border-black/15 text-sm bg-white"
                  >
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                    Gateway Display Name (Shown at Checkout)
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-black/15 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                    Environment Mode
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'test' | 'live')}
                    className="w-full px-3.5 py-2.5 border border-black/15 text-sm bg-white"
                  >
                    <option value="test">Test / Sandbox Mode</option>
                    <option value="live">Live Production Mode</option>
                  </select>
                </div>
              </div>

              {isOnlineProvider && (
                <div className="space-y-3 p-4 bg-[#F5F5F5] border border-black/10">
                  <div>
                    <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                      Public API Key
                    </label>
                    <input
                      type="text"
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder="pk_test_... / FLWPUBK_TEST-..."
                      className="w-full px-3.5 py-2 bg-white border border-black/15 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                      Secret API Key {editing?.hasSecretKey ? '(Leave blank to keep existing)' : ''}
                    </label>
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      placeholder="sk_test_... (Encrypted on server)"
                      className="w-full px-3.5 py-2 bg-white border border-black/15 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111111]/70 mb-1">
                      Webhook Secret {editing?.hasWebhookSecret ? '(Leave blank to keep existing)' : ''}
                    </label>
                    <input
                      type="password"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder="whsec_..."
                      className="w-full px-3.5 py-2 bg-white border border-black/15 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              {provider === 'bank_transfer' && (
                <div className="space-y-3 p-4 bg-[#F5F5F5] border border-black/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Bank Name</label>
                      <input
                        type="text"
                        required
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-black/15 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        required
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-black/15 text-sm font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Account Name
                    </label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-black/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Payment Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-black/15 text-sm"
                    />
                  </div>
                </div>
              )}

              {provider === 'cash_on_delivery' && (
                <div className="space-y-3 p-4 bg-[#F5F5F5] border border-black/10">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Additional COD Fee (₦)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={additionalFee}
                      onChange={(e) => setAdditionalFee(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-black/15 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2">
                      Eligible Delivery Regions
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {shippingZones.map((z) => {
                        const checked = eligibleStates.includes(z.stateName);
                        return (
                          <label key={z.id} className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEligibleStates((prev) =>
                                  checked
                                    ? prev.filter((s) => s !== z.stateName)
                                    : [...prev, z.stateName]
                                )
                              }
                            />
                            <span>{z.stateName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-6 pt-2 text-xs">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>Activate on Customer Checkout</span>
                </label>
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <span>Set as Default Gateway</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-black/20 text-xs font-semibold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
                >
                  {saving ? 'Saving...' : 'Save Gateway'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
