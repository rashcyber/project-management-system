import React, { useState, useEffect } from 'react';
import { Link, Copy, Trash2, Plus, Loader, AlertCircle } from 'lucide-react';
import { Button, Modal, DeleteConfirmModal } from './common';
import useUserStore from '../store/userStore';
import { toast } from '../store/toastStore';
import './InviteLinksManager.css';

const InviteLinksManager = () => {
  const { generateInviteLink, getInviteLinks, revokeInviteLink } = useUserStore();

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, action: null, linkId: null });

  const [formData, setFormData] = useState({
    role: 'member',
    maxUses: '',
    expiresInDays: 7,
  });

  useEffect(() => {
    loadInviteLinks();
  }, []);

  const loadInviteLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await getInviteLinks();
      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      toast.error('Failed to load invite links');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const maxUses = formData.maxUses ? parseInt(formData.maxUses) : null;
      const { data, error } = await generateInviteLink(
        formData.role,
        maxUses,
        formData.expiresInDays
      );

      if (error) throw error;

      toast.success('Invite link generated successfully!');
      setLinks([data, ...links]);
      setShowModal(false);
      setFormData({ role: 'member', maxUses: '', expiresInDays: 7 });
    } catch (error) {
      toast.error('Failed to generate invite link');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (code) => {
    const appUrl = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
    const inviteUrl = `${appUrl}/signup?invite=${code}`;

    navigator.clipboard.writeText(inviteUrl);
    setCopiedId(code);
    toast.success('Link copied to clipboard!');

    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeLink = async (linkId) => {
    setConfirmDialog({
      isOpen: true,
      action: 'revoke',
      linkId,
    });
  };

  const handleReactivateLink = async (linkId) => {
    try {
      const { error } = await revokeInviteLink(linkId, true);
      if (error) throw error;

      setLinks(links.map(l => l.id === linkId ? { ...l, is_active: true } : l));
      toast.success('Invite link reactivated');
    } catch (error) {
      toast.error('Failed to reactivate link');
      console.error(error);
    }
  };

  const handleDeleteLink = async (linkId) => {
    setConfirmDialog({
      isOpen: true,
      action: 'delete',
      linkId,
    });
  };

  const handleConfirmAction = async () => {
    try {
      if (confirmDialog.action === 'revoke') {
        const { error } = await revokeInviteLink(confirmDialog.linkId);
        if (error) throw error;
        setLinks(links.map(l => l.id === confirmDialog.linkId ? { ...l, is_active: false } : l));
        toast.success('Invite link revoked');
      } else if (confirmDialog.action === 'delete') {
        const { error } = await revokeInviteLink(confirmDialog.linkId, false, true);
        if (error) throw error;
        setLinks(links.filter(l => l.id !== confirmDialog.linkId));
        toast.success('Invite link deleted');
      }
    } catch (error) {
      toast.error(`Failed to ${confirmDialog.action} link`);
      console.error(error);
    } finally {
      setConfirmDialog({ isOpen: false, action: null, linkId: null });
    }
  };

  const getActiveLinksCount = () => {
    return links.filter(l => l.is_active && (!l.expires_at || new Date(l.expires_at) > new Date())).length;
  };

  const isLinkExpired = (link) => {
    return link.expires_at && new Date(link.expires_at) <= new Date();
  };

  const isLinkMaxedOut = (link) => {
    return link.max_uses && link.used_count >= link.max_uses;
  };

  const getRoleColor = (role) => {
    const colors = {
      member: '#22c55e',
      manager: '#3b82f6',
      admin: '#f59e0b',
      super_admin: '#ef4444',
    };
    return colors[role] || '#6b7280';
  };

  if (loading && links.length === 0) {
    return (
      <div className="invite-links-manager">
        <div className="loading-state">
          <Loader className="animate-spin" size={24} />
          <p>Loading invite links...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-links-manager">
      {/* Header */}
      <div className="invite-links-header">
        <div>
          <h2>Invite Links</h2>
          <p>Share links to let others join your workspace</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Generate New Link
        </Button>
      </div>

      {/* Stats */}
      <div className="invite-links-stats">
        <div className="stat-card">
          <span className="stat-label">Active Links</span>
          <span className="stat-value">{getActiveLinksCount()}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Links</span>
          <span className="stat-value">{links.length}</span>
        </div>
      </div>

      {/* Links List */}
      {links.length === 0 ? (
        <div className="empty-state">
          <Link size={48} />
          <h3>No invite links yet</h3>
          <p>Create your first invite link to share with team members</p>
        </div>
      ) : (
        <div className="invite-links-list">
          {links.map((link) => {
            const expired = isLinkExpired(link);
            const maxedOut = isLinkMaxedOut(link);
            const isActive = link.is_active && !expired && !maxedOut;

            return (
              <div
                key={link.id}
                className={`invite-link-card ${!link.is_active ? 'revoked' : ''} ${expired ? 'expired' : ''} ${maxedOut ? 'maxed-out' : ''}`}
              >
                {/* Status Badge */}
                {!link.is_active && (
                  <div className="status-badge revoked-badge">Revoked</div>
                )}
                {expired && link.is_active && (
                  <div className="status-badge expired-badge">Expired</div>
                )}
                {maxedOut && link.is_active && !expired && (
                  <div className="status-badge maxed-badge">Max Uses Reached</div>
                )}

                {/* Link Info */}
                <div className="link-info">
                  <div className="link-row">
                    <span className="link-label">Link Code:</span>
                    <code className="link-code">{link.code}</code>
                  </div>

                  <div className="link-row">
                    <span className="link-label">Role:</span>
                    <span
                      className="role-badge"
                      style={{ backgroundColor: `${getRoleColor(link.role)}20`, color: getRoleColor(link.role) }}
                    >
                      {link.role}
                    </span>
                  </div>

                  <div className="link-row">
                    <span className="link-label">Uses:</span>
                    <span className="link-uses">
                      {link.used_count}/{link.max_uses || '∞'}
                    </span>
                  </div>

                  {link.expires_at && (
                    <div className="link-row">
                      <span className="link-label">Expires:</span>
                      <span className="link-expires">
                        {new Date(link.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  <div className="link-row">
                    <span className="link-label">Created:</span>
                    <span className="link-created">
                      {new Date(link.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Full Invite URL */}
                <div className="full-link-section">
                  <input
                    type="text"
                    readOnly
                    value={`${import.meta.env.VITE_APP_URL || 'http://localhost:5173'}/signup?invite=${link.code}`}
                    className="full-link-input"
                  />
                </div>

                {/* Actions */}
                <div className="link-actions">
                  {isActive && (
                    <button
                      className="action-btn copy-btn"
                      onClick={() => handleCopyLink(link.code)}
                      title="Copy invite link"
                    >
                      <Copy size={18} />
                      {copiedId === link.code ? 'Copied!' : 'Copy Link'}
                    </button>
                  )}
                  {link.is_active && (
                    <button
                      className="action-btn revoke-btn"
                      onClick={() => handleRevokeLink(link.id)}
                      title="Revoke this link"
                    >
                      <Trash2 size={18} />
                      Revoke
                    </button>
                  )}
                  {!link.is_active && (
                    <>
                      <button
                        className="action-btn reactivate-btn"
                        onClick={() => handleReactivateLink(link.id)}
                        title="Reactivate this link"
                      >
                        <Link size={18} />
                        Reactivate
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteLink(link.id)}
                        title="Delete this link permanently"
                      >
                        <Trash2 size={18} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <DeleteConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, action: null, linkId: null })}
        onConfirm={handleConfirmAction}
        title={confirmDialog.action === 'delete' ? 'Delete Link' : 'Revoke Link'}
        message={
          confirmDialog.action === 'delete'
            ? 'Are you sure you want to delete this link permanently? This action cannot be undone.'
            : 'Are you sure you want to revoke this link? It can be reactivated later.'
        }
        isLoading={loading}
      />

      {/* Generate Link Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="generate-link-modal">
          <h2>Generate Invite Link</h2>

          <form onSubmit={handleGenerateLink}>
            {/* Role Selection */}
            <div className="form-row">
              <label className="form-label">Default Role for New Users</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="form-control"
              >
                <option value="member">Member</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
              <span className="form-help">Users who join with this link will get this role</span>
            </div>

            {/* Max Uses */}
            <div className="form-row">
              <label className="form-label">Maximum Uses</label>
              <input
                type="number"
                min="1"
                placeholder="Leave blank for unlimited uses"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                className="form-control"
              />
              <span className="form-help">Leave blank to allow unlimited uses</span>
            </div>

            {/* Expiration */}
            <div className="form-row">
              <label className="form-label">Expires In (days)</label>
              <input
                type="number"
                min="1"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                className="form-control"
              />
              <span className="form-help">The link will expire after this many days</span>
            </div>

            {/* Info Box */}
            <div className="info-box">
              <AlertCircle size={18} />
              <div>
                <p className="info-title">Link Details</p>
                <p className="info-text">
                  Users can sign up using this link and will automatically join your workspace with the role you specify.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={loading}>
                Generate Link
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};

export default InviteLinksManager;
