// Use only disposable fixtures. No application/database connection is made.
const fs = require('node:fs');
const tls = require('node:tls');
const [certificate, key, root] = process.argv.slice(2);
if (!certificate || !key || !root) throw new Error('Expected disposable certificate, key and root paths');
const rejectionCodes = new Set(['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_UNTRUSTED']);
const server = tls.createServer({cert: fs.readFileSync(certificate), key: fs.readFileSync(key)}, socket => socket.end());
server.on('tlsClientError', () => {});
function probe(port, trusted) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const socket = tls.connect({host:'127.0.0.1', port, servername:'private-ca-control.invalid',
      rejectUnauthorized:true, ...(trusted ? {ca:fs.readFileSync(root)} : {})});
    const done = (ok, reason) => {if(finished)return;finished=true;socket.destroy();ok ? resolve() : reject(new Error(reason));};
    socket.setTimeout(8000, () => done(false,'timeout'));
    socket.once('secureConnect', () => done(trusted,'Unexpected trusted connection'));
    socket.once('error', error => done(!trusted && rejectionCodes.has(error.code),error.code || 'unknown error'));
  });
}
(async () => {
  try {
    await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const port=server.address().port;
    await probe(port,true);await probe(port,false);
    console.log(JSON.stringify({node:process.version,trusted_private_ca_accepted:true,untrusted_private_ca_rejected:true,synthetic_only:true}));
  } catch (error) {
    console.error('Private CA check failed: '+error.message);process.exitCode=1;
  } finally {server.close();}
})();
