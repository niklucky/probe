export function publicizeStorageUrl(signedUrl: string, publicOrigin: string) {
  const signed = new URL(signedUrl);
  const publicUrl = new URL(publicOrigin);
  signed.protocol = publicUrl.protocol;
  signed.hostname = publicUrl.hostname;
  signed.port = publicUrl.port;
  return signed.toString();
}
