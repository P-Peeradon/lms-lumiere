using the_identity.Helper;
using the_identity.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddGrpc();

var app = builder.Build();

// Ensure the ECC key pair exists in Azure Key Vault before serving requests.
IdentityHelper.GetOrCreateVaultEccPublicKey();

// Configure the HTTP request pipeline.
app.MapGrpcService<IdentityService>();
app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

app.Run();
