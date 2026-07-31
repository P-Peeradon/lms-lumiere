using System.Security.Cryptography;
using System.Text;

namespace the_identity.Helper;

public static class IdentityHelper
{
    public static string validateDocument(IDictionary<string, string> documentFields)
    {
        // Placeholder for zod-style structural checks, regex validation, checksum, contextual rules,
        // and cross-field consistency.
        if (documentFields is null || documentFields.Count == 0)
        {
            throw new ArgumentException("Document fields are required.");
        }

        // This method should return a serialized validation result in a production service.
        return "validated";
    }

    public static (byte[] EncryptedPayload, byte[] Iv, byte[] Tag, byte[] EncryptedDataKey) encryptData(byte[] rawPii, byte[] publicKey)
    {
        var aesKey = new byte[32];
        RandomNumberGenerator.Fill(aesKey);

        var iv = new byte[12];
        RandomNumberGenerator.Fill(iv);

        var tag = new byte[16];
        var ciphertext = new byte[rawPii.Length];
        using (var aesGcm = new AesGcm(aesKey))
        {
            aesGcm.Encrypt(iv, rawPii, ciphertext, tag, null);
        }

        var wrappedAesKey = WrapAesKeyWithEccPublicKey(aesKey, publicKey);

        return (EncryptedPayload: ciphertext, Iv: iv, Tag: tag, EncryptedDataKey: wrappedAesKey);
    }

    public static byte[] decryptData(byte[] encryptedPayload, byte[] iv, byte[] tag, byte[] encryptedAesKey)
    {
        // Placeholder: unwrap the AES key with the private key from a vault.
        var aesKey = UnwrapAesKeyWithVault(encryptedAesKey);

        var plaintext = new byte[encryptedPayload.Length];
        using (var aesGcm = new AesGcm(aesKey))
        {
            aesGcm.Decrypt(iv, encryptedPayload, tag, plaintext, null);
        }

        return plaintext;
    }

    public static byte[] generateHMAC(string fieldValue)
    {
        var secretBase64 = Environment.GetEnvironmentVariable("HMAC_SEARCH_KEY_SECRET");
        if (string.IsNullOrWhiteSpace(secretBase64))
        {
            throw new InvalidOperationException("HMAC_SEARCH_KEY_SECRET environment variable is required.");
        }

        var secret = Convert.FromBase64String(secretBase64);
        var bytes = Encoding.UTF8.GetBytes(fieldValue ?? string.Empty);
        using var hmac = new HMACSHA256(secret);
        return hmac.ComputeHash(bytes);
    }

    public static string generateShadowID()
    {
        var buffer = new byte[32];
        RandomNumberGenerator.Fill(buffer);
        return Convert.ToHexString(buffer).ToLowerInvariant();
    }

    private static byte[] WrapAesKeyWithEccPublicKey(byte[] aesKey, byte[] publicKey)
    {
        using var sha256 = SHA256.Create();
        var combined = new byte[aesKey.Length + publicKey.Length];
        Buffer.BlockCopy(aesKey, 0, combined, 0, aesKey.Length);
        Buffer.BlockCopy(publicKey, 0, combined, aesKey.Length, publicKey.Length);
        return sha256.ComputeHash(combined);
    }

    private static byte[] UnwrapAesKeyWithVault(byte[] encryptedAesKey)
    {
        // Placeholder: use secure KMS/vault to unwrap AES key.
        using var sha256 = SHA256.Create();
        return sha256.ComputeHash(encryptedAesKey);
    }
}
