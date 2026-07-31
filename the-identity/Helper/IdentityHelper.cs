using System.Collections.Generic;
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

    public static string GenerateShadowId(
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
