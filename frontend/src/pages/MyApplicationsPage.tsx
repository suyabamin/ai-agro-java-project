import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationService } from '../services/applicationService';
import type { JobApplication, ApplicationMessage, ApplicationStatus } from '../types/job';

export const MyApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active chat modal
  const [activeApp, setActiveApp] = useState<JobApplication | null>(null);
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    loadMyApplications();
  }, []);

  const loadMyApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await applicationService.getMyApplications();
      setApplications(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load applications';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (applicationId: string) => {
    if (!window.confirm('Are you sure you want to withdraw this application?')) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await applicationService.withdrawApplication(applicationId);
      if (res.data) {
        setSuccess('Application successfully withdrawn');
        setApplications((prev) => prev.map((a) => (a.applicationId === applicationId ? res.data! : a)));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw application');
    }
  };

  const openChat = async (app: JobApplication) => {
    setActiveApp(app);
    setChatLoading(true);
    try {
      const res = await applicationService.getApplicationMessages(app.applicationId);
      setMessages(res.data || []);
    } catch (err) {
      console.warn('Failed to fetch messages:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApp || !newMessage.trim()) return;

    try {
      const res = await applicationService.sendMessage(activeApp.applicationId, {
        message: newMessage.trim(),
      });
      if (res.data) {
        const msgItem = res.data;
        setMessages((prev) => [...prev, msgItem]);
        setNewMessage('');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
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
          padding: '2px 8px',
          borderRadius: '10px',
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1B4332', margin: 0 }}>
            My Job Applications
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: '4px 0 0' }}>
            Track the status of your applications, communicate with hiring managers, and view recruitment feedback.
          </p>
        </div>
        <Link
          to="/jobs"
          style={{
            padding: '8px 16px',
            backgroundColor: '#2D6A4F',
            color: '#FFFFFF',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Explore More Jobs
        </Link>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', backgroundColor: '#D1FAE5', color: '#065F46', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
          {success}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#6B7280' }}>Loading your applications...</p>
      ) : applications.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', padding: '40px', textAlign: 'center', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: '16px', color: '#374151', margin: 0 }}>You have not applied for any jobs yet.</p>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '6px' }}>
            Visit the <Link to="/jobs" style={{ color: '#2D6A4F', fontWeight: 600 }}>Farmer Marketplace</Link> to explore open vacancies.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>Application ID</th>
                <th style={{ padding: '12px 16px' }}>Job ID</th>
                <th style={{ padding: '12px 16px' }}>Date Submitted</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Review Notes</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.applicationId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {app.applicationId}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#1B4332' }}>{app.jobId}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{getStatusBadge(app.status)}</td>
                  <td style={{ padding: '12px 16px', color: '#4B5563' }}>
                    {app.reviewNotes || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openChat(app)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: '#F3F4F6',
                          border: '1px solid #D1D5DB',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        💬 Messages
                      </button>
                      {app.status !== 'WITHDRAWN' && app.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleWithdraw(app.applicationId)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#FEE2E2',
                            color: '#991B1B',
                            border: '1px solid #FCA5A5',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Messaging Drawer / Modal */}
      {activeApp && (
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
              maxWidth: '560px',
              height: '500px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#1B4332' }}>Candidate Message Thread</h3>
                <span style={{ fontSize: '11px', color: '#6B7280' }}>Application: {activeApp.applicationId}</span>
              </div>
              <button onClick={() => setActiveApp(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', backgroundColor: '#F9FAFB', borderRadius: '6px', marginBottom: '12px' }}>
              {chatLoading ? (
                <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>Loading conversation...</p>
              ) : messages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6B7280', fontSize: '13px', margin: 'auto' }}>
                  No messages yet. Send a note to the farm hiring team!
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.messageId}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: m.senderUid === activeApp.applicantUid ? '#DCFCE7' : '#FFFFFF',
                      alignSelf: m.senderUid === activeApp.applicantUid ? 'flex-end' : 'flex-start',
                      border: '1px solid #E5E7EB',
                      maxWidth: '85%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '11px', color: '#6B7280', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600 }}>{m.senderName}</span>
                      <span>{new Date(m.sentAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#1F2937' }}>{m.message}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Write a message to farm manager..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '13px' }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
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
        </div>
      )}
    </div>
  );
};
