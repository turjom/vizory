import type { SupabaseClient } from "@supabase/supabase-js"
import * as ImageManipulator from "expo-image-manipulator"

import type { SupabaseDatabase } from "@/types/supabase"

export const SKU_PHOTOS_BUCKET = "sku-photos"

async function compressSkuPhoto(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  )
  return result.uri
}

/**
 * Compresses the image, uploads to `sku-photos` at `{userId}/{skuId}.jpg`, returns public URL.
 */
export async function uploadSkuPhotoToStorage(
  supabase: SupabaseClient<SupabaseDatabase>,
  userId: string,
  skuId: string,
  localUri: string,
): Promise<string> {
  const jpegUri = await compressSkuPhoto(localUri)
  const path = `${userId}/${skuId}.jpg`
  const response = await fetch(jpegUri)
  const arrayBuffer = await response.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(SKU_PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: "image/jpeg", upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(SKU_PHOTOS_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
