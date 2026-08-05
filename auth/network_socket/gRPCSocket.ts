import grpc, { ChannelCredentials } from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path, { resolve } from 'node:path';

const identityProto = path.resolve(__dirname, "..", "..", "the-identity", "Protos", "identity.proto");

const packageDef = protoLoader.loadSync(identityProto, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto: any = grpc.loadPackageDefinition(packageDef).identity;

const creds: ChannelCredentials = grpc.credentials.createSsl();
const client = proto.IdentityService("localhost:5120", creds)

client.encryptedPII = function encryptedPII(
    client: any,
    req: Record<string, any>,
    options?: { bearerToken?: string }
): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
        const metadata = new grpc.Metadata();
        if (options?.bearerToken) metadata.add("authorization", `Bearer ${options.bearerToken}`);

        // gRPC method signature: client.decryptPII(request, metadata?, callback)
        client.encryptedPII(req, metadata, (err: any, res: any) => {
            if (err) return reject(err);
            resolve(res);
        });
    })
}

export default client;