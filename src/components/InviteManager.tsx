import { useState, useEffect } from 'react';
import { createInvite, getMyInvites, revokeInvite, Invite } from '@/lib/invites';

export default function InviteManager() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    expiresInDays: 7,
    maxUses: 1,
    notes: '',
  });

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      const data = await getMyInvites();
      setInvites(data);
    } catch (error) {
      console.error('Error loading invites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createInvite({
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        expiresInDays: formData.expiresInDays || undefined,
        maxUses: formData.maxUses,
        notes: formData.notes || undefined,
      });
      setFormData({ email: '', phone: '', expiresInDays: 7, maxUses: 1, notes: '' });
      setShowCreateForm(false);
      loadInvites();
    } catch (error) {
      console.error('Error creating invite:', error);
      alert('Failed to create invite');
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm('Are you sure you want to revoke this invite?')) return;
    try {
      await revokeInvite(inviteId);
      loadInvites();
    } catch (error) {
      console.error('Error revoking invite:', error);
      alert('Failed to revoke invite');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Invite code copied to clipboard!');
  };

  if (loading) {
    return <div className="text-center py-8">Loading invites...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Invite Codes</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-medium transition"
        >
          {showCreateForm ? 'Cancel' : '+ Create Invite'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New Invite</h2>
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (optional - restrict to specific email)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone (optional - restrict to specific phone)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+1234567890"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expires in (days)
                </label>
                <input
                  type="number"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Uses
                </label>
                <input
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  min="1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g., For new members from tournament"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-lg font-medium transition"
            >
              Generate Invite Code
            </button>
          </form>
        </div>
      )}

      {/* Invites List */}
      <div className="space-y-4">
        {invites.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No invites created yet</p>
          </div>
        ) : (
          invites.map((invite) => {
            const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
            const isFullyUsed = invite.current_uses >= invite.max_uses;
            const isActive = !isExpired && !isFullyUsed;

            return (
              <div
                key={invite.id}
                className={`bg-white rounded-lg shadow-sm p-6 border ${
                  isActive ? 'border-gray-200' : 'border-gray-300 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-2xl font-bold text-primary bg-primary bg-opacity-10 px-4 py-2 rounded">
                        {invite.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(invite.code)}
                        className="text-sm text-primary hover:text-primary-dark"
                      >
                        Copy
                      </button>
                    </div>
                    {invite.notes && (
                      <p className="text-sm text-gray-600 mb-1">📝 {invite.notes}</p>
                    )}
                    {invite.email && (
                      <p className="text-sm text-gray-600">📧 Restricted to: {invite.email}</p>
                    )}
                    {invite.phone && (
                      <p className="text-sm text-gray-600">📱 Restricted to: {invite.phone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {isActive ? (
                      <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm font-medium">
                        Active
                      </span>
                    ) : isExpired ? (
                      <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium">
                        Expired
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-sm font-medium">
                        Fully Used
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm text-gray-600">
                  <div className="space-y-1">
                    <p>
                      Uses: {invite.current_uses} / {invite.max_uses}
                    </p>
                    {invite.expires_at && (
                      <p>Expires: {new Date(invite.expires_at).toLocaleDateString()}</p>
                    )}
                    <p>Created: {new Date(invite.created_at).toLocaleDateString()}</p>
                  </div>
                  {isActive && (
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
