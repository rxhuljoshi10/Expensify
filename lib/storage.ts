// lib/storage.ts
// Utilities for uploading and managing receipt attachments in Supabase Storage.
// Bucket name: 'receipt-attachments'
// Object path pattern: attachments/{user_id}/{timestamp}.jpg

import { supabase } from './supabase';

const BUCKET = 'receipt-attachments';

/**
 * Converts a base64 string to a Uint8Array without any external library.
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Uploads a base64-encoded JPEG to Supabase Storage.
 * Returns the storage path (NOT a public URL) on success.
 */
export const uploadReceiptAttachment = async (
    userId: string,
    base64: string,
): Promise<string> => {
    const filePath = `attachments/${userId}/${Date.now()}.jpg`;
    const bytes = base64ToUint8Array(base64);

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, bytes, {
            contentType: 'image/jpeg',
            upsert: false,
        });

    if (error) throw error;
    return filePath;
};

/**
 * Creates a short-lived signed URL (valid 60 minutes) for viewing a stored receipt.
 */
export const getReceiptSignedUrl = async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60); // 1 hour

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
};

/**
 * Deletes a stored receipt from the bucket.
 */
export const deleteReceiptAttachment = async (path: string): Promise<void> => {
    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([path]);

    if (error) throw error;
};
