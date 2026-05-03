/**
 * Supabase Storage Service
 *
 * Implements the StorageService interface for Supabase.
 */

import type { StorageService, StorageResult, StorageUploadOptions, StorageFileInfo } from "../types"
import { getSupabaseClient } from "./client"

// ============================================================================
// Supabase Storage Service Implementation
// ============================================================================

export function createSupabaseStorageService(): StorageService {
  const getClient = () => getSupabaseClient()

  return {
    async upload(
      bucket: string,
      path: string,
      file: Blob | ArrayBuffer | File,
      options?: StorageUploadOptions,
    ): Promise<StorageResult<{ path: string; id?: string }>> {
      const { data, error } = await getClient().storage.from(bucket).upload(path, file, {
        contentType: options?.contentType,
        cacheControl: options?.cacheControl,
        upsert: options?.upsert,
      })

      return {
        data: data ? { path: data.path, id: data.id } : null,
        error: error
          ? {
              name: "StorageError",
              message: error.message,
              code: error.name,
            }
          : null,
      }
    },

    async download(bucket: string, path: string): Promise<StorageResult<Blob>> {
      const { data, error } = await getClient().storage.from(bucket).download(path)

      return {
        data,
        error: error
          ? {
              name: "StorageError",
              message: error.message,
              code: error.name,
            }
          : null,
      }
    },

    getPublicUrl(bucket: string, path: string): string {
      const { data } = getClient().storage.from(bucket).getPublicUrl(path)
      return data.publicUrl
    },

    async createSignedUrl(
      bucket: string,
      path: string,
      expiresIn: number,
    ): Promise<StorageResult<{ signedUrl: string }>> {
      const { data, error } = await getClient()
        .storage.from(bucket)
        .createSignedUrl(path, expiresIn)

      return {
        data: data ? { signedUrl: data.signedUrl } : null,
        error: error
          ? {
              name: "StorageError",
              message: error.message,
              code: error.name,
            }
          : null,
      }
    },

    async remove(bucket: string, paths: string[]): Promise<StorageResult<void>> {
      const { error } = await getClient().storage.from(bucket).remove(paths)

      return {
        data: null,
        error: error
          ? {
              name: "StorageError",
              message: error.message,
              code: error.name,
            }
          : null,
      }
    },

    async list(
      bucket: string,
      path?: string,
      options?: { limit?: number; offset?: number },
    ): Promise<StorageResult<StorageFileInfo[]>> {
      const { data, error } = await getClient().storage.from(bucket).list(path, {
        limit: options?.limit,
        offset: options?.offset,
      })

      const files: StorageFileInfo[] | null = data
        ? data.map((file) => ({
            id: file.id ?? "",
            name: file.name,
            size: file.metadata?.size ?? 0,
            contentType: file.metadata?.mimetype,
            createdAt: file.created_at ?? undefined,
            updatedAt: file.updated_at ?? undefined,
          }))
        : null

      return {
        data: files,
        error: error
          ? {
              name: "StorageError",
              message: error.message,
              code: error.name,
            }
          : null,
      }
    },
  }
}
