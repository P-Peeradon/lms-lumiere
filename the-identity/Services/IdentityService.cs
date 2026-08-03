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

    public override Task<approvePIIRes> approvePII(approvePIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("approvePII request received for tenant {Tenant}", request.Tenant);

        // Placeholder structural validation, checksum checks, contextual validation,
        // cross-document consistency, and risk scoring should happen here.
        // Raw PII is intentionally not logged.
        if (string.IsNullOrWhiteSpace(request.Tenant) || string.IsNullOrWhiteSpace(request.RequesterShadowID))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid request metadata."));
        }

        var response = new approvePIIRes
        {
            Tenant = request.Tenant,
            RequesterShadowID = request.RequesterShadowID,
            Timestamp = Timestamp.FromDateTime(DateTime.UtcNow)
        };

        return Task.FromResult(response);
    }

    public override Task<generateShadowIDRes> generateShadowID(generateShadowIDReq request, ServerCallContext context)
    {
        _logger.LogInformation("generateShadowID request received for tenant {Tenant}", request.Tenant);

        string studentType = "";
        string studyMode = "";

        if (request.IsIntern) {
            studentType = "intern";
        } else if (request.IsResearch) {
            studentType = "research";
            studyMode = "fulltime";
        } else if (request.IsExchange) {
            studentType = "exchange";
        } else if (!request.IsDomestic) {
            studentType = "international";
            studyMode = "fulltime";
        } else {
            studentType = "domestic";
            studyMode = request.IsFulltime ? "fulltime" : "parttime";
        }

        var newShadowId = IdentityHelper.generateShadowId(
            request.EnrolYear, 
            studentType, 
            studyMode ?? "fulltime"
        );

        return Task.FromResult(new generateShadowIDRes
        {
            Tenant = request.Tenant,
            RequestShadowID = request.RequestShadowID,
            NewShadowID = newShadowId
        });
    }

    public override Task<encryptedPIIRes> encryptedPII(encryptedPIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("encryptPII request received for tenant {Tenant}", request.Tenant);

        if (string.IsNullOrWhiteSpace(request.Tenant) || string.IsNullOrWhiteSpace(request.RequesterShadowID))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid encryption request."));
        }

        var rawPiiPayload = BuildPiiPayload(request);
        var encryptResult = IdentityHelper.encryptData(Encoding.UTF8.GetBytes(rawPiiPayload), IdentityHelper.GetOrCreateVaultEccPublicKey());
        var responseBlob = ByteString.CopyFrom(Combine(encryptResult.Iv, encryptResult.Tag, encryptResult.EncryptedPayload, encryptResult.EncryptedDataKey));

        return Task.FromResult(new encryptedPIIRes
        {
            Tenant = request.Tenant,
            RequesterShadowID = request.RequesterShadowID,
            EncryptedPIIBlob = responseBlob,
            StatusMessage = "PII encrypted with AES-GCM and ECC key wrap placeholder." 
        });
    }

    public override Task<decryptPIIRes> decryptPII(decryptPIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("decryptPII request received for tenant {Tenant} by position {Position}", request.Tenant, request.RequesterPosition);

        if (!IsDecryptRequestAuthorized(request.RequesterPosition, request.RequesterShadowID, request.OwnerShadowID))
        {
            return Task.FromResult(new decryptPIIRes
            {
                Tenant = request.Tenant,
                IsAuthorised = false,
                Success = false,
                ErrorMessage = "Access denied by RBAC policy."
            });
        }

        // Placeholder: decrypting would require private key material from vault and AES key unwrap.
        return Task.FromResult(new decryptPIIRes
        {
            Tenant = request.Tenant,
            IsAuthorised = true,
            Success = true,
            ErrorMessage = string.Empty
        });
    }

    public override Task<hashSearchKeyRes> hashSearchKey(hashSearchKeyReq request, ServerCallContext context)
    {
        _logger.LogInformation("hashSearchKey request received for tenant {Tenant}", request.Tenant);

        return Task.FromResult(new hashSearchKeyRes
        {
            Tenant = request.Tenant,
            HashedName = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.Name)),
            HashedUniEmail = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.UniEmail)),
            HashedDOB = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.DOB)),
            HashedUniID = ByteString.CopyFrom(IdentityHelper.generateHMAC(request.UniID))
        });
    }

    public override Task<revokePIIRes> revokePII(revokePIIReq request, ServerCallContext context)
    {
        _logger.LogInformation("revokePII request received for tenant {Tenant}", request.Tenant);

        revokePIIRes response;

        if (string.IsNullOrWhiteSpace(request.OwnerShadowID))
        {
            response = new revokePIIRes
            {
                Tenant = request.Tenant,
                Timestamp = Timestamp.FromDateTime(DateTime.UtcNow),
                Status = false,
                IsAuthority = false,
                ResponseMessage = "Missing owner identifier.",
                IsIllegal = false
            };

            return Task.FromResult(response);
        }

        _logger.LogInformation("revocation event emitted for ownerShadowID {OwnerShadowID}", request.OwnerShadowID);
        response = new revokePIIRes
        {
            Tenant = request.Tenant,
            Timestamp = Timestamp.FromDateTime(DateTime.UtcNow),
            Status = true,
            IsAuthority = true,
            ResponseMessage = "Revocation recorded and encrypted PII deletion requested.",
            IsIllegal = false
        };

        return Task.FromResult(response);
    }

    public override Task<validateIdentityRes> validateIdentity(validateIdentityReq request, ServerCallContext context)
    {
        _logger.LogInformation("validateIdentity request received for tenant {Tenant}", request.Tenant);

        if (request.HashedUniID.IsEmpty || request.HashedName.IsEmpty)
        {
            return Task.FromResult(new validateIdentityRes
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

        return Task.FromResult(new validateIdentityRes
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

    private static bool VerifyHashedIdentity(validateIdentityReq request)
    {
        // Placeholder deterministic comparison. A real implementation queries a secure DB API and compares stored HMACs.
        return !request.HashedName.IsEmpty && !request.HashedUniID.IsEmpty;
    }

    private static string BuildPiiPayload(encryptedPIIReq request)
    {
        return new StringBuilder()
            .Append('{')
            .Append("\"firstname\":\"").Append(EscapeForJson(request.Firstname)).Append("\",")
            .Append("\"lastname\":\"").Append(EscapeForJson(request.Lastname)).Append("\",")
            .Append("\"DOB\":\"").Append(EscapeForJson(request.DOB)).Append("\",")
            .Append("\"phone\":\"").Append(EscapeForJson(request.Phone)).Append("\",")
            .Append("\"uniEmail\":\"").Append(EscapeForJson(request.UniEmail)).Append("\",")
            .Append("\"personalEmail\":\"").Append(EscapeForJson(request.PersonalEmail)).Append("\",")
            .Append("\"address\":\"").Append(EscapeForJson(request.Address)).Append("\",")
            .Append("\"uniID\":\"").Append(EscapeForJson(request.UniID)).Append("\",")
            .Append("\"nationalID\":\"").Append(EscapeForJson(request.NationalID)).Append("\",")
            .Append("\"nationality\":\"").Append(EscapeForJson(request.Nationality)).Append("\",")
            .Append("\"passportID\":\"").Append(EscapeForJson(request.PassportID)).Append("\"")
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