import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import type { ClientDocument } from '../types';

// ============================================
// DOCUMENT QUERIES
// ============================================

interface DocumentFilters {
  clientId?: string | null;
  communityId?: string | null;
  documentType?: string;
}

export function useDocuments(filters: DocumentFilters) {
  return useQuery({
    queryKey: ['client-documents', filters],
    queryFn: async () => {
      let query = supabase
        .from('client_documents')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (filters.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters.communityId) {
        query = query.eq('community_id', filters.communityId);
      }

      if (filters.documentType) {
        query = query.eq('document_type', filters.documentType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ClientDocument[];
    },
    enabled: !!(filters.clientId || filters.communityId),
  });
}

// ============================================
// DOCUMENT MUTATIONS
// ============================================

interface UploadDocumentInput {
  file: File;
  clientId?: string | null;
  communityId?: string | null;
  documentType: ClientDocument['document_type'];
  name: string;
  effectiveDate?: string | null;
  expirationDate?: string | null;
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadDocumentInput) => {
      const { file, clientId, communityId, documentType, name, effectiveDate, expirationDate } = input;

      if (!clientId && !communityId) {
        throw new Error('Must specify either clientId or communityId');
      }

      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const folder = clientId ? `clients/${clientId}` : `communities/${communityId}`;
      const fileName = `${Date.now()}_${name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('client-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('client-documents')
        .getPublicUrl(filePath);

      // Create document record
      const { data: doc, error: insertError } = await supabase
        .from('client_documents')
        .insert({
          client_id: clientId || null,
          community_id: communityId || null,
          document_type: documentType,
          name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.type,
          effective_date: effectiveDate || null,
          expiration_date: expirationDate || null,
        })
        .select()
        .single();

      if (insertError) {
        // Clean up uploaded file
        await supabase.storage.from('client-documents').remove([filePath]);
        throw insertError;
      }

      return doc;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['client-documents', { clientId: result.client_id, communityId: result.community_id }],
      });
      showSuccess('Document uploaded');
    },
    onError: (error) => {
      showError(error.message);
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<ClientDocument, 'name' | 'document_type' | 'effective_date' | 'expiration_date'>> }) => {
      const { data: result, error } = await supabase
        .from('client_documents')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['client-documents', { clientId: result.client_id, communityId: result.community_id }],
      });
      showSuccess('Document updated');
    },
    onError: (error) => {
      showError(error.message);
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, fileUrl, clientId, communityId }: { id: string; fileUrl: string; clientId?: string | null; communityId?: string | null }) => {
      // Delete from database
      const { error: dbError } = await supabase
        .from('client_documents')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      // Try to delete from storage (extract path from URL)
      try {
        const url = new URL(fileUrl);
        const pathMatch = url.pathname.match(/client-documents\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from('client-documents').remove([pathMatch[1]]);
        }
      } catch {
        // Ignore storage delete errors
        console.warn('Could not delete file from storage');
      }

      return { id, clientId, communityId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['client-documents', { clientId: result.clientId, communityId: result.communityId }],
      });
      showSuccess('Document deleted');
    },
    onError: (error) => {
      showError(error.message);
    },
  });
}

// ============================================
// DOCUMENT HELPERS
// ============================================

export const DOCUMENT_TYPE_LABELS: Record<ClientDocument['document_type'], string> = {
  contract: 'Contract',
  pricing_agreement: 'Pricing Agreement',
  w9: 'W-9',
  insurance: 'Insurance',
  other: 'Other',
};

export function getDocumentIcon(documentType: string): string {
  switch (documentType) {
    case 'contract':
      return 'file-text';
    case 'pricing_agreement':
      return 'dollar-sign';
    case 'w9':
      return 'file-check';
    case 'insurance':
      return 'shield';
    default:
      return 'file';
  }
}

export function isDocumentExpiring(expirationDate: string | null, daysWarning = 30): boolean {
  if (!expirationDate) return false;
  const expDate = new Date(expirationDate);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + daysWarning);
  return expDate <= warningDate;
}

export function isDocumentExpired(expirationDate: string | null): boolean {
  if (!expirationDate) return false;
  return new Date(expirationDate) < new Date();
}
