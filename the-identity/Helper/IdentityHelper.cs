using Azure;
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
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
        using (var aesGcm = new AesGcm(aesKey, 16))
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
        using (var aesGcm = new AesGcm(aesKey, 16))
        {
            aesGcm.Decrypt(iv, encryptedPayload, tag, plaintext, null);
        }

        return plaintext;
    }

    public static byte[] GetOrCreateVaultEccPublicKey()
    {
        // Read the Key Vault URI from environment variables.
        var vaultUri = Environment.GetEnvironmentVariable("AZURE_KEY_VAULT_URI");
        if (string.IsNullOrWhiteSpace(vaultUri))
        {
            throw new InvalidOperationException("AZURE_KEY_VAULT_URI environment variable is required to initialize ECC key material.");
        }

        // Read the key name or use a default if none is configured.
        var keyName = Environment.GetEnvironmentVariable("AZURE_ECC_KEY_NAME") ?? "lms-ecc-key";

        // Create a Key Vault secret client using Azure identity.
        var secretClient = new SecretClient(new Uri(vaultUri), new DefaultAzureCredential());

        // Use separate secret names for public and private key material.
        var publicSecretName = $"{keyName}-public";
        var privateSecretName = $"{keyName}-private";

        try
        {
            // Try to read the existing public key from Key Vault.
            var publicSecret = secretClient.GetSecret(publicSecretName);
            // Decode the stored Base64 string into raw public key bytes.
            return Convert.FromBase64String(publicSecret.Value.Value);
        }
        catch (RequestFailedException ex) when (ex.Status == 404)
        {
            // If the public key secret does not exist, create and store a new key pair.
            return CreateAndStoreEccKeyPair(secretClient, publicSecretName, privateSecretName);
        }
    }

    public static byte[] GetVaultEccPrivateKey()
    {
        // Read the Key Vault URI from environment variables.
        var vaultUri = Environment.GetEnvironmentVariable("AZURE_KEY_VAULT_URI");
        if (string.IsNullOrWhiteSpace(vaultUri))
        {
            throw new InvalidOperationException("AZURE_KEY_VAULT_URI environment variable is required to initialize ECC key material.");
        }

        // Read the key name or use a default if none is configured.
        var keyName = Environment.GetEnvironmentVariable("AZURE_ECC_KEY_NAME") ?? "lms-ecc-key";

        // Create a Key Vault secret client using Azure identity.
        var secretClient = new SecretClient(new Uri(vaultUri), new DefaultAzureCredential());

        // Build the private key secret name and read it from Key Vault.
        var privateSecretName = $"{keyName}-private";
        var privateSecret = secretClient.GetSecret(privateSecretName);

        // Decode the stored Base64 string into raw private key bytes.
        return Convert.FromBase64String(privateSecret.Value.Value);
    }

    private static byte[] CreateAndStoreEccKeyPair(SecretClient secretClient, string publicSecretName, string privateSecretName)
    {
        // Create a new ephemeral ECDH key pair on the NIST P-256 curve.
        using var ecdh = ECDiffieHellman.Create(ECCurve.NamedCurves.nistP256);

        // Export the public key as SubjectPublicKeyInfo (standard ASN.1 format).
        var publicKey = ecdh.ExportSubjectPublicKeyInfo();

        // Export the private key in PKCS#8 format.
        var privateKey = ecdh.ExportECPrivateKey();

        // Store both public and private keys in Key Vault as Base64 strings.
        secretClient.SetSecret(publicSecretName, Convert.ToBase64String(publicKey));
        secretClient.SetSecret(privateSecretName, Convert.ToBase64String(privateKey));

        // Return the public key bytes for immediate use.
        return publicKey;
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

    private static char DeterminePrefix(int year, string studentType, string studyMode)
    {
        studentType = studentType.ToLower();
        studyMode = studyMode.ToLower();

        // Intern always overrides
        if (studentType == "intern")
            return 'X';

        // Before AY2023
        if (year < 2023)
        {
            return studentType switch
            {
                "domestic" => 'D',
                "international" => 'W',
                "exchange" => 'E',
                _ => throw new ArgumentException("Invalid studentType before 2023.")
            };
        }

        // From AY2023 onward
        if (year >= 2023)
        {
            if (studentType == "exchange")
                return 'S';

            if (studentType == "research")
                return 'R'; // always full-time

            return studyMode switch
            {
                "fulltime" => 'M',
                "parttime" => 'P',
                _ => throw new ArgumentException("Invalid studyMode from 2023 onward.")
            };
        }

        throw new ArgumentException("Invalid year.");
    }

    private static char ComputeChecksum(char prefix, string digits7)
    {
        char[] ChecksumAlphabet = {'K','L','J','N','P','Q','R','T','U','W','X','Y','Z'};
        int[] Weights = { 2, 7, 6, 5, 4, 3, 2 };

        int sum = 0;

        for (int i = 0; i < 7; i++)
        {
            int digit = digits7[i] - '0';
            sum += digit * Weights[i];
        }

        // Apply offsets
        if (prefix == 'P' || prefix == 'X')
            sum += 5;
        else if (prefix == 'R')
            sum += 4;

        int remainder = sum % 13;
        return ChecksumAlphabet[remainder];
    }

    private static string GenerateRandomDigits7()
    {
        Random rng = new Random();
        int number = rng.Next(0, 10_000_000);
        return number.ToString("D7");
    }

    public static string generateShadowId(
        int yearOfEnrollment,
        string studentType,   // domestic, international, exchange, intern, research
        string studyMode      // fulltime, parttime
    )
    {
        string digits7 = GenerateRandomDigits7();
        char prefix = DeterminePrefix(yearOfEnrollment, studentType, studyMode);
        char checksum = ComputeChecksum(prefix, digits7);

        return $"{prefix}{digits7}{checksum}";
    }

    public static bool validateShadowID(string shadowId, bool before2023)
    {
        if (string.IsNullOrWhiteSpace(shadowId) || shadowId.Length != 9)
        {
            return false;
        }

        var prefix = shadowId[0];
        var digitSegment = shadowId.Substring(1, 7);
        var checksum = shadowId[8];

        if (!new[] { 'R', 'X', 'P', 'E', 'S' }.Contains(prefix))
        {
            return false;
        }

        if (!digitSegment.All(char.IsDigit))
        {
            return false;
        }

        if (prefix == 'E' && !before2023)
        {
            return false;
        }

        if (prefix == 'S' && before2023)
        {
            return false;
        }

        var offset = prefix switch
        {
            'R' => 4,
            'X' => 5,
            'P' => 5,
            _ => 0
        };

        var expectedChecksum = ComputeChecksum(prefix, digitSegment);
        return checksum == expectedChecksum;
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
