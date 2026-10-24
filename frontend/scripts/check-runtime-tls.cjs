// TLS handshakes only: default Node roots, or --use-openssl-ca for the OS store.
const tls = require('node:tls');
const hosts = ['dv', 'ov', 'ev'].flatMap(kind => ['g3b', 'g3c'].flatMap(gen =>
  ['', 'aaa-'].map(via => `${kind}-${gen}-${via}emudhra.we-have-a-problem.com`)));
const positives = ['github.com', 'nodejs.org'];
const rejectionCodes = new Set(['CERT_REVOKED', 'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_UNTRUSTED']);
function probe(host) {
  const positive = positives.includes(host);
  return new Promise(resolve => {
    let finished = false;
    const socket = tls.connect({ host, port: 443, servername: host });
    const finish = (status, reason) => {
      if (finished) return;
      finished = true; socket.destroy();
      resolve({ host, positive_control: positive, status, reason });
    };
    socket.setTimeout(12000, () => finish('unknown', 'timeout'));
    socket.once('secureConnect', () => finish(positive ? 'pass' : 'fail', 'verified_connection'));
    socket.once('error', error => finish(!positive && rejectionCodes.has(error.code) ? 'pass' : 'unknown', error.code));
  });
}
(async () => {
  const results = [];
  const all = [...hosts, ...positives];
  for (let i = 0; i < all.length; i += 4) results.push(...await Promise.all(all.slice(i, i + 4).map(probe)));
  console.log(JSON.stringify({node:process.version, results}));
  process.exitCode = results.every(row => row.status === 'pass') ? 0 : 1;
})();
