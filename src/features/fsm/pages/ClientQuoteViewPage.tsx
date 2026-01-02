/**
 * ClientQuoteViewPage - Public page for clients to view and approve quotes
 *
 * Accessed via: /client-quote/:token
 *
 * Features:
 * - View quote details without authentication
 * - See line items and totals
 * - Approve quote with optional notes
 * - Request changes
 * - Contact sales rep
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Calendar,
  FileText,
  MapPin,
  Building2,
  MessageSquare,
} from 'lucide-react';
import type { Quote, QuoteLineItem } from '../types';

interface QuoteWithDetails extends Omit<Quote, 'sales_rep' | 'client'> {
  line_items: QuoteLineItem[];
  client: {
    id: string;
    name: string;
    primary_contact_name?: string;
  };
  community?: {
    id: string;
    name: string;
  };
  sales_rep?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
}

export default function ClientQuoteViewPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteWithDetails | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approved, setApproved] = useState(false);
  const [changesRequested, setChangesRequested] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid quote link');
      setLoading(false);
      return;
    }
    loadQuote();
  }, [token]);

  const loadQuote = async () => {
    try {
      // Find quote by view token
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          client:clients(id, name, primary_contact_name),
          community:communities(id, name),
          line_items:quote_line_items(*)
        `)
        .eq('view_token', token)
        .single();

      if (quoteError || !quoteData) {
        setError('Quote not found or link has expired');
        setLoading(false);
        return;
      }

      // Fetch sales rep user profile if assigned
      let salesRep = null;
      if (quoteData.sales_rep_user_id) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('id, full_name, email, phone')
          .eq('id', quoteData.sales_rep_user_id)
          .single();

        if (userProfile) {
          salesRep = {
            id: userProfile.id,
            name: userProfile.full_name || userProfile.email || 'Unknown',
            email: userProfile.email || undefined,
            phone: userProfile.phone || undefined,
          };
        }
      }

      // Add sales_rep to quote data
      quoteData.sales_rep = salesRep;

      // Check if token has expired (7 days)
      const tokenCreatedAt = quoteData.view_token_created_at;
      if (tokenCreatedAt) {
        const tokenAge = Date.now() - new Date(tokenCreatedAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (tokenAge > sevenDays) {
          setError('This quote link has expired. Please contact your sales representative for a new link.');
          setLoading(false);
          return;
        }
      }

      // Track view count
      await supabase
        .from('quotes')
        .update({
          client_viewed_count: (quoteData.client_viewed_count || 0) + 1,
          viewed_at: quoteData.viewed_at || new Date().toISOString(),
        })
        .eq('id', quoteData.id);

      setQuote(quoteData as QuoteWithDetails);
      setLoading(false);
    } catch (err) {
      console.error('Error loading quote:', err);
      setError('Failed to load quote');
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!quote) return;
    setSubmitting(true);

    try {
      const response = await fetch('/.netlify/functions/approve-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          token,
          action: 'approve',
          notes: approvalNotes || undefined,
          poNumber: poNumber || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve quote');
      }

      setApproved(true);
      setShowApproveModal(false);
    } catch (err) {
      console.error('Approve error:', err);
      alert(err instanceof Error ? err.message : 'Failed to approve quote');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!quote || !changeNotes.trim()) return;
    setSubmitting(true);

    try {
      const response = await fetch('/.netlify/functions/approve-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.id,
          token,
          action: 'request_changes',
          notes: changeNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit change request');
      }

      setChangesRequested(true);
      setShowChangesModal(false);
    } catch (err) {
      console.error('Request changes error:', err);
      alert(err instanceof Error ? err.message : 'Failed to submit change request');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading your quote...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Quote</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            If you need assistance, please contact Discount Fence USA at{' '}
            <a href="tel:5124433623" className="text-blue-600 hover:underline">(512) 443-3623</a>
          </p>
        </div>
      </div>
    );
  }

  // Approved state
  if (approved) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Quote Approved!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for approving Quote #{quote?.quote_number}. Your sales representative will be in touch shortly to schedule your project.
          </p>
          {quote?.sales_rep_user && (
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-gray-900 mb-2">Your Sales Representative:</p>
              <p className="text-gray-700">{quote.sales_rep_user.name}</p>
              {quote.sales_rep_user.phone && (
                <a href={`tel:${quote.sales_rep_user.phone}`} className="text-blue-600 hover:underline text-sm">
                  {quote.sales_rep_user.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Changes requested state
  if (changesRequested) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <MessageSquare className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Change Request Submitted</h1>
          <p className="text-gray-600 mb-6">
            Your change request for Quote #{quote?.quote_number} has been submitted. Your sales representative will review your feedback and send an updated quote.
          </p>
          {quote?.sales_rep_user && (
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-gray-900 mb-2">Your Sales Representative:</p>
              <p className="text-gray-700">{quote.sales_rep_user.name}</p>
              {quote.sales_rep_user.phone && (
                <a href={`tel:${quote.sales_rep_user.phone}`} className="text-blue-600 hover:underline text-sm">
                  {quote.sales_rep_user.phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!quote) return null;

  // Filter visible line items
  const visibleLineItems = quote.line_items?.filter(item => item.is_visible_to_client !== false) || [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-800 text-white py-6">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-2xl font-bold">Discount Fence USA</h1>
          <p className="text-blue-200">Your Quote</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Quote Header Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Quote #{quote.quote_number}</h2>
              <p className="text-gray-600">{quote.client?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-700">{formatCurrency(quote.total)}</p>
              {quote.valid_until && (
                <p className="text-sm text-gray-500 flex items-center justify-end gap-1 mt-1">
                  <Calendar className="w-4 h-4" />
                  Valid until {formatDate(quote.valid_until)}
                </p>
              )}
            </div>
          </div>

          {/* Job Address */}
          {quote.job_address && (
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg mb-4">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Job Location</p>
                <p className="text-gray-900">
                  {quote.job_address.line1}
                  {quote.job_address.line2 && <>, {quote.job_address.line2}</>}
                </p>
                <p className="text-gray-600">
                  {quote.job_address.city}, {quote.job_address.state} {quote.job_address.zip}
                </p>
              </div>
            </div>
          )}

          {/* Scope Summary */}
          {quote.scope_summary && (
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700">Project Scope</p>
                <p className="text-gray-900 whitespace-pre-wrap">{quote.scope_summary}</p>
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quote Details</h3>

          <div className="divide-y">
            {visibleLineItems.map((item) => (
              <div key={item.id} className="py-3 flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  {item.quantity > 1 && (
                    <p className="text-sm text-gray-500">
                      {item.quantity} × {formatCurrency(item.unit_price)}
                      {item.unit_type && ` per ${item.unit_type}`}
                    </p>
                  )}
                </div>
                <p className="font-medium text-gray-900 ml-4">{formatCurrency(item.total_price)}</p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t mt-4 pt-4 space-y-2">
            {quote.subtotal !== quote.total && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(quote.subtotal)}</span>
                </div>
                {quote.discount_amount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(quote.discount_amount)}</span>
                  </div>
                )}
                {quote.tax_amount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax ({(quote.tax_rate * 100).toFixed(2)}%)</span>
                    <span>{formatCurrency(quote.tax_amount)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {/* Deposit Required */}
          {quote.deposit_required > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800">
                <strong>Deposit Required:</strong> {formatCurrency(quote.deposit_required)}
                {quote.deposit_percent > 0 && ` (${quote.deposit_percent}%)`}
              </p>
            </div>
          )}
        </div>

        {/* Terms */}
        {quote.payment_terms && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Terms</h3>
            <p className="text-gray-700">{quote.payment_terms}</p>
          </div>
        )}

        {/* Sales Rep Contact */}
        {quote.sales_rep_user && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Sales Representative</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{quote.sales_rep_user.name}</p>
                <div className="flex gap-4 mt-1">
                  {quote.sales_rep_user.phone && (
                    <a
                      href={`tel:${quote.sales_rep_user.phone}`}
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                    >
                      <Phone className="w-4 h-4" />
                      {quote.sales_rep_user.phone}
                    </a>
                  )}
                  {quote.sales_rep_user.email && (
                    <a
                      href={`mailto:${quote.sales_rep_user.email}`}
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                    >
                      <Mail className="w-4 h-4" />
                      Email
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-xl shadow-sm p-6 sticky bottom-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowApproveModal(true)}
              className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Approve Quote
            </button>
            <button
              onClick={() => setShowChangesModal(true)}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Request Changes
            </button>
          </div>
        </div>
      </main>

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Approve Quote</h3>
            <p className="text-gray-600 mb-4">
              By approving this quote, you authorize Discount Fence USA to proceed with the work as described.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PO Number <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Enter your PO number if applicable"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Any special instructions or notes..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Approve Quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showChangesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Request Changes</h3>
            <p className="text-gray-600 mb-4">
              Please describe the changes you'd like us to make to this quote. Your sales representative will review and send an updated quote.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What changes would you like? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                placeholder="Describe the changes you need..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowChangesModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={submitting || !changeNotes.trim()}
                className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="font-semibold mb-2">Discount Fence USA</p>
          <p className="text-gray-400 text-sm">Austin, TX | (512) 443-3623</p>
          <p className="text-gray-500 text-xs mt-4">
            Questions about your quote? Contact your sales representative or call us.
          </p>
        </div>
      </footer>
    </div>
  );
}
