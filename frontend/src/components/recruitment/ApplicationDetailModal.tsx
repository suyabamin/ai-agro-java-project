import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { applicationService } from '../../services/applicationService';
import type {
  JobApplication,
  ApplicationHistory,
  ApplicationMessage,
  ApplicationStatus,
} from '../../types/job';

interface ApplicationDetailModalProps {
  isOpen: boolean;
  farmId: string;
  application: JobApplication | null;
  onClose: () => void;
  onApplicationUpdated: (updated: JobApplication) => void;
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  isOpen,
  farmId,
  application,
  onClose,
  onApplicationUpdated,
}) => {
  const [history, setHistory] = useState<ApplicationHistory[]>([]);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'messages'>('details');

  const [decisionNote, setDecisionNote] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (application && isOpen) {
      loadHistory();
      loadMessages();
      setError(null);
      setSuccess(null);
      setDecisionNote('');
    }
  }, [application, isOpen]);

  if (!isOpen || !application) return null;

  const loadHistory = async () => {
    try {
      const res = await applicationService.getApplicationHistory(application.applicationId);
      if (res.data) setHistory(res.data);
    } catch (e) {
      console.warn('Failed to load application history:', e);
    }
  };

  const loadMessages = async () => {
    try {
      const res = await applicationService.getApplicationMessages(application.applicationId);
      if (res.data) setMessages(res.data);
    } catch (e) {
      console.warn('Failed to load application messages:', e);
    }
  };

  const handleAction = async (action: 'review' | 'shortlist' | 'approve' | 'reject') => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let res;
      if (action === 'review') {
        res = await applicationService.reviewApplication(farmId, application.applicationId);
      } else if (action === 'shortlist') {
        res = await applicationService.shortlistApplication(farmId, application.applicationId);
      } else if (action === 'approve') {
        res = await applicationService.approveApplication(farmId, application.applicationId, {
          note: decisionNote.trim() || undefined,
          version: application.version,
        });
      } else {
        res = await applicationService.rejectApplication(farmId, application.applicationId, {
          note: decisionNote.trim() || undefined,
          version: application.version,
        });
      }

      if (res.data) {
        setSuccess(`Application marked as ${res.data.status}`);
        onApplicationUpdated(res.data);
        loadHistory();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await applicationService.sendMessage(application.applicationId, {
        message: newMessage.trim(),
      });
      if (res.data) {
        const msgItem = res.data;
        setMessages((prev) => [...prev, msgItem]);
        setNewMessage('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ApplicationStatus) => {
    const map: Record<ApplicationStatus, { bg: string; text: string }> = {
      SUBMITTED: { bg: '#E0E7FF', text: '#3730A3' },
      UNDER_REVIEW: { bg: '#FEF3C7', text: '#92400E' },
      SHORTLISTED: { bg: '#DBEAFE', text: '#1E40AF' },
      APPROVED: { bg: '#D1FAE5', text: '#065F46' },
      REJECTED: { bg: '#FEE2E2', text: '#991B1B' },
      WITHDRAWN: { bg: '#F3F4F6', text: '#4B5563' },
    };
    const c = map[status] || { bg: '#F3F4F6', text: '#4B5563' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 8px',
          borderRadius: '12px',
          backgroundColor: c.bg,
          color: c.text,
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          padding: '24px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1B4332' }}>
                {application.applicantName || 'Candidate Application'}
              </h3>
              {getStatusBadge(application.status)}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280' }}>
              Email: {application.applicantEmail} | Application ID: <code>{application.applicationId}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6B7280' }}
          >
            ✕
          </button>
        </div>

        {/* Tab selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', marginBottom: '16px', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('details')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'details' ? '2px solid #2D6A4F' : '2px solid transparent',
              background: 'none',
              fontWeight: 600,
              fontSize: '13px',
              color: activeTab === 'details' ? '#2D6A4F' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            Candidate Details
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'history' ? '2px solid #2D6A4F' : '2px solid transparent',
              background: 'none',
              fontWeight: 600,
              fontSize: '13px',
              color: activeTab === 'history' ? '#2D6A4F' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            Audit Trail ({history.length})
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderBottom: activeTab === 'messages' ? '2px solid #2D6A4F' : '2px solid transparent',
              background: 'none',
              fontWeight: 600,
              fontSize: '13px',
              color: activeTab === 'messages' ? '#2D6A4F' : '#6B7280',
              cursor: 'pointer',
            }}
          >
            Discussion Thread ({messages.length})
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: '8px 12px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
            {success}
          </div>
        )}

        {/* Content body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>Experience:</span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1B4332' }}>
                    {application.experienceYears != null ? `${application.experienceYears} Years` : 'Not specified'}
                  </div>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#6B7280' }}>Expected Salary:</span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1B4332' }}>
                    {application.expectedSalary != null ? `${application.expectedSalary} BDT` : 'Negotiable'}
                  </div>
                </div>
              </div>

              {application.relevantSkills && application.relevantSkills.length > 0 && (
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Skills:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {application.relevantSkills.map((sk) => (
                      <span key={sk} style={{ padding: '2px 8px', backgroundColor: '#E5E7EB', borderRadius: '10px', fontSize: '11px' }}>
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Cover Letter / Note:</span>
                <div
                  style={{
                    marginTop: '4px',
                    padding: '12px',
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    minHeight: '80px',
                  }}
                >
                  {application.coverLetter || 'No cover letter submitted.'}
                </div>
              </div>

              {/* Review decisions */}
              {application.status !== 'APPROVED' && application.status !== 'REJECTED' && application.status !== 'WITHDRAWN' && (
                <div style={{ marginTop: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    Decision / Review Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide evaluation notes for shortlist, approval, or rejection..."
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
                  />

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    {application.status === 'SUBMITTED' && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleAction('review')}
                        style={{ padding: '6px 14px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Mark Under Review
                      </button>
                    )}
                    {application.status !== 'SHORTLISTED' && (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleAction('shortlist')}
                        style={{ padding: '6px 14px', backgroundColor: '#DBEAFE', color: '#1E40AF', border: '1px solid #93C5FD', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Shortlist Candidate
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAction('approve')}
                      style={{ padding: '6px 14px', backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Approve Application
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAction('reject')}
                      style={{ padding: '6px 14px', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Reject Application
                    </button>
                  </div>
                </div>
              )}

              {/* Approved Candidate Allocation Action */}
              {application.status === 'APPROVED' && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #E5E7EB', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#065F46', display: 'block' }}>
                      Approved Candidate
                    </span>
                    <span style={{ fontSize: '11px', color: '#6B7280' }}>
                      Candidate is eligible to be assigned to a field zone.
                    </span>
                  </div>
                  <Link
                    to={`/dashboard/assignments/new?farmerUid=${encodeURIComponent(application.applicantUid)}&applicationId=${encodeURIComponent(application.applicationId)}`}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#006a38',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Assign to Field Zone</span>
                    <span>→</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '16px 0' }}>No history records recorded yet.</p>
              ) : (
                history.map((h) => (
                  <div key={h.historyId} style={{ padding: '10px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#1B4332' }}>
                        {h.fromStatus} → {h.toStatus}
                      </span>
                      <span style={{ color: '#9CA3AF' }}>{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    {h.note && <p style={{ margin: '4px 0 0', color: '#4B5563' }}>Note: {h.note}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, minHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {messages.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: '20px 0', textAlign: 'center' }}>
                    No messages yet in this candidate discussion thread.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.messageId}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        backgroundColor: m.senderUid === application.applicantUid ? '#F3F4F6' : '#DCFCE7',
                        alignSelf: m.senderUid === application.applicantUid ? 'flex-start' : 'flex-end',
                        maxWidth: '85%',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '2px', fontSize: '11px', color: '#6B7280' }}>
                        <span style={{ fontWeight: 600 }}>{m.senderName || m.senderUid}</span>
                        <span>{new Date(m.sentAt).toLocaleTimeString()}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '13px', color: '#1F2937' }}>{m.message}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Type a message to the applicant..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  disabled={loading || !newMessage.trim()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2D6A4F',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
