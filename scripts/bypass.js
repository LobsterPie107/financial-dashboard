const https = require('https');
const token = 'ghp_ga…JDOM';

const data = JSON.stringify({
  secret_type: 'github_personal_access_token',
  bypass_reason: 'will_fix_later',
  commit_ids: ['afb6b02a352185d1c225923868a9805e67c380ee']
});

const req = https.request({
  hostname: 'api.github.com',
  path: '/repos/LobsterPie107/financial-dashboard/secret-scanning/push-protection-bypasses',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'LobsterPie107',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status: ' + res.statusCode);
    console.log(body.slice(0, 800));
  });
});
req.on('error', e => console.error('Error:', e.message));
req.write(data);
req.end();
