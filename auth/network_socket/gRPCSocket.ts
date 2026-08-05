import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const pkgDef = protoLoader.loadSync('d:/lms-lumiere/the-identity/Protos/identity.proto', {});
const grpcObj = grpc.loadPackageDefinition(pkgDef) as any;
const client = new grpcObj.identity.IdentityService('localhost:7120', grpc.credentials.createInsecure());
// If TLS, use grpc.credentials.createSsl(...)

export default client;