using System.Text;
using Google.Protobuf;
using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using the_identity.Helper;

namespace the_identity.Services;

public class IdentityService : the_identity.IdentityService.IdentityServiceBase
{
    private readonly ILogger<IdentityService> _logger;

    public IdentityService(ILogger<IdentityService> logger)
    {
        _logger = logger;
    }

    public override Task<ApprovePIIRes> ApprovePII(ApprovePIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("approvePII request received for tenant {Tenant}", request.Tenant);

        // Placeholder structural validation, checksum checks, contextual validation,
        // cross-document consistency, and risk scoring should happen here.
        // Raw PII is intentionally not logged.
        if (string.IsNullOrWhiteSpace(request.Tenant) || string.IsNullOrWhiteSpace(request.RequestShadowID))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid request metadata."));
        }

        return Task.FromResult(new ApprovePIIRes
        {
            Tenant = request.Tenant,
            RequestShadowID = request.RequestShadowID,
            Timestamp = Timestamp.FromDateTime(DateTime.UtcNow)
        });
    }

    public override Task<GenerateShadowIDRes> GenerateShadowID(GenerateShadowIDReq request, ServerCallContext context)
    {
        _logger.LogInformation("generateShadowID request received for tenant {Tenant}", request.Tenant);

        string studentType = "";
        string studyMode = "";

        if (request.isIntern) {
            studentType = "intern";
        } else if (request.isResearch) {
            studentType = "research";
            studyMode = "fulltime";
        } else if (request.isExchange) {
            studentType = "exchange";
        } else if (!request.isDomestic) {
            studentType = "international";
            studyMode = "fulltime";
        } else {
            studentType = "domestic";
            studyMode = request.isFulltime ? "fulltime" : "parttime";
        }

        var newShadowId = IdentityHelper.generateShadowID(request.enrolYear, studentType, studyMode);

        return Task.FromResult(new GenerateShadowIDRes
        {
            Tenant = request.Tenant,
            RequestShadowID = request.RequestShadowID,
            NewShadowID = newShadowId
        });
    }

    public override Task<EncryptedPIIRes> EncryptedPII(EncryptedPIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("encryptPII request received for tenant {Tenant}", request.Tenant);

        if (string.IsNullOrWhiteSpace(request.Tenant) || string.IsNullOrWhiteSpace(request.RequesterShadowID))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid encryption request."));
        }

        var rawPiiPayload = BuildPiiPayload(request);
        var encryptResult = IdentityHelper.encryptData(Encoding.UTF8.GetBytes(rawPiiPayload), GetPlaceholderEccPublicKey());
        var responseBlob = ByteString.CopyFrom(Combine(encryptResult.Iv, encryptResult.Tag, encryptResult.EncryptedPayload, encryptResult.EncryptedDataKey));

        return Task.FromResult(new EncryptedPIIRes
        {
            Tenant = request.Tenant,
            RequesterShadowID = request.RequesterShadowID,
            EncryptedPIIBlob = responseBlob,
            StatusMessage = "PII encrypted with AES-GCM and ECC key wrap placeholder." 
        });
    }

    public override Task<DecryptPIIRes> DecryptPII(DecryptPIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("decryptPII request received for tenant {Tenant} by position {Position}", request.Tenant, request.RequesterPosition);

        if (!IsDecryptRequestAuthorized(request.RequesterPosition, request.RequesterShadowID, request.OwnerShadowID))
        {
            return Task.FromResult(new DecryptPIIRes
            {
                Tenant = request.Tenant,
                IsAuthorised = false,
                Success = false,
                ErrorMessage = "Access denied by RBAC policy."
            });
        }

        // Placeholder: decrypting would require private key material from vault and AES key unwrap.
        return Task.FromResult(new DecryptPIIRes
        {
            Tenant = request.Tenant,
            IsAuthorised = true,
            Success = true,
            ErrorMessage = string.Empty
        });
    }

    public override Task<HashSearchKeyRes> HashSearchKey(HashSearchKeyReq request, ServerCallContext context)
    {
        _logger.LogInformation("hashSearchKey request received for tenant {Tenant}", request.Tenant);

        return Task.FromResult(new HashSearchKeyRes
        {
            Tenant = request.Tenant,
            HashedName = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.Name)),
            HashedUniEmail = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.UniEmail)),
            HashedDOB = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.Dob)),
            HashedUniID = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.UniId))
        });
    }

    public override Task<RevokePIIRes> RevokePII(RevokePIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("revokePII request received for tenant {Tenant}", request.Tenant);

        if (string.IsNullOrWhiteSpace(request.OwnerShadowID))
        {
            return Task.FromResult(new RevokePIIRes
            {
                Tenant = request.Tenant,
                Timestamp = Timestamp.FromDateTime(DateTime.UtcNow),
                Status = false,
                IsAuthority = false,
                ResponseMessage = "Missing owner identifier.",
                IsIllegal = false
            });
        }

        _logger.LogInformation("revocation event emitted for ownerShadowID {OwnerShadowID}", request.OwnerShadowID);

        return Task.FromResult(new RevokePIIRes
        {
            Tenant = request.Tenant,
            Timestamp = Timestamp.FromDateTime(DateTime.UtcNow),
            Status = true,
            IsAuthority = true,
            ResponseMessage = "Revocation recorded and encrypted PII deletion requested.",
            IsIllegal = false
        });
    }

    public override Task<ValidateIdentityRes> ValidateIdentity(ValidateIdentityReq request, ServerCallContext context)
    {
        _logger.LogInformation("validateIdentity request received for tenant {Tenant}", request.Tenant);

        if (request.HashedUniId.IsEmpty || request.HashedName.IsEmpty)
        {
            return Task.FromResult(new ValidateIdentityRes
            {
                Tenant = request.Tenant,
                RequesterShadowID = request.RequesterShadowID,
                IsAuthorised = false,
                Success = false,
                ErrorMessage = "Missing required hashed identity fields."
            });
        }

        // Placeholder verification: compare hashed query values to stored values from DB API.
        var verified = VerifyHashedIdentity(request);

        return Task.FromResult(new ValidateIdentityRes
        {
            Tenant = request.Tenant,
            RequesterShadowID = request.RequesterShadowID,
            IsAuthorised = verified,
            Success = verified,
            ShadowID = verified ? request.RequesterShadowID : string.Empty,
            ErrorMessage = verified ? string.Empty : "Identity verification failed." 
        });
    }


    private static bool IsDecryptRequestAuthorized(string requesterPosition, string requesterShadowId, string ownerShadowId)
    {
        if (string.IsNullOrWhiteSpace(requesterPosition))
        {
            return false;
        }

        // Policy placeholders
        if (requesterPosition.Equals("student", StringComparison.OrdinalIgnoreCase) && !string.Equals(requesterShadowId, ownerShadowId, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (requesterPosition.Equals("lecturer", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (requesterPosition.Equals("faculty_admin", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return true;
    }

    private static bool VerifyHashedIdentity(ValidateIdentityReq request)
    {
        // Placeholder deterministic comparison. A real implementation queries a secure DB API and compares stored HMACs.
        return !request.HashedName.IsEmpty && !request.HashedUniId.IsEmpty;
    }

    private static string BuildPiiPayload(EncryptedPIIReq request)
    {
        return new StringBuilder()
            .Append('{')
            .Append("\"firstname\":\"").Append(EscapeForJson(request.Firstname)).Append("\",")
            .Append("\"lastname\":\"").Append(EscapeForJson(request.Lastname)).Append("\",")
            .Append("\"DOB\":\"").Append(EscapeForJson(request.Dob)).Append("\",")
            .Append("\"phone\":\"").Append(EscapeForJson(request.Phone)).Append("\",")
            .Append("\"uniEmail\":\"").Append(EscapeForJson(request.UniEmail)).Append("\",")
            .Append("\"personalEmail\":\"").Append(EscapeForJson(request.PersonalEmail)).Append("\",")
            .Append("\"address\":\"").Append(EscapeForJson(request.Address)).Append("\",")
            .Append("\"uniID\":\"").Append(EscapeForJson(request.UniId)).Append("\",")
            .Append("\"nationalID\":\"").Append(EscapeForJson(request.NationalId)).Append("\",")
            .Append("\"nationality\":\"").Append(EscapeForJson(request.Nationality)).Append("\",")
            .Append("\"passportID\":\"").Append(EscapeForJson(request.PassportId)).Append("\"")
            .Append('}')
            .ToString();
    }

    private static string EscapeForJson(string value)
    {
        return value?.Replace("\\", "\\\\").Replace("\"", "\\\"") ?? string.Empty;
    }

    private static byte[] Combine(params byte[][] values)
    {
        var totalLength = values.Sum(v => v.Length);
        var result = new byte[totalLength];
        var offset = 0;
        foreach (var value in values)
        {
            Buffer.BlockCopy(value, 0, result, offset, value.Length);
            offset += value.Length;
        }

        return result;
    }
}
